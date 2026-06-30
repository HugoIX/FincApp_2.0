using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/v1/aura")]
public class AuraAgentController : ControllerBase
{
  private static readonly HttpClient GeminiHttp = new();
  private static readonly Dictionary<string, List<string>> ConversationMemory = new();
  private static readonly object MemoryLock = new();

  private readonly IConfiguration _configuration;
  private readonly IWebHostEnvironment _environment;
  private readonly FincAppDbContext _context;

  public AuraAgentController(
    IConfiguration configuration,
    IWebHostEnvironment environment,
    FincAppDbContext context)
  {
    _configuration = configuration;
    _environment = environment;
    _context = context;
  }

  [HttpPost("agent")]
  public async Task<IActionResult> Agent([FromBody] AuraAgentRequest request)
  {
    var text = request.Text ?? string.Empty;
    var sessionId = string.IsNullOrWhiteSpace(request.SessionId)
      ? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "default"
      : request.SessionId;

    if (string.IsNullOrWhiteSpace(text))
    {
      return Ok(new AuraAgentResponse
      {
        Mode = "local_fallback",
        Intent = "unknown",
        Action = "none",
        AssistantMessage = "no escuché ningún comando. Inténtelo otra vez paso a paso.",
        AuraResponse = "no escuché ningún comando. Inténtelo otra vez paso a paso.",
        RawText = text,
        Confidence = "low",
        MissingFields = new List<string> { "raw_text" }
      });
    }

    AuraAgentResponse agentResponse;

    try
    {
      agentResponse = await AskGeminiAsync(text, sessionId, request.FarmId);
    }
    catch
    {
      agentResponse = BuildLocalFallback(text);
    }

    agentResponse.RawText = text;
    agentResponse = await ApplyBusinessRulesAsync(agentResponse, request.FarmId);

    Remember(sessionId, $"USER: {text}");
    Remember(sessionId, $"AURA_JSON: {JsonSerializer.Serialize(agentResponse)}");

    return Ok(agentResponse);
  }

  private async Task<AuraAgentResponse> AskGeminiAsync(string text, string sessionId, string? farmId)
  {
    var apiKey = _configuration["Gemini:ApiKey"];
    var model = _configuration["Gemini:Model"] ?? "gemini-3.5-flash";

    if (string.IsNullOrWhiteSpace(apiKey))
    {
      return BuildLocalFallback(text);
    }

    if (model.StartsWith("models/", StringComparison.OrdinalIgnoreCase))
    {
      model = model.Replace("models/", "", StringComparison.OrdinalIgnoreCase);
    }

    var context = LoadAuraContext();
    var history = GetHistory(sessionId);
    var prompt = BuildUserPrompt(text, farmId, history);

    var requestBody = new
    {
      systemInstruction = new
      {
        parts = new[]
        {
          new { text = context }
        }
      },
      contents = new[]
      {
        new
        {
          role = "user",
          parts = new[]
          {
            new { text = prompt }
          }
        }
      },
      generationConfig = new
      {
        responseMimeType = "application/json",
        temperature = 0.35,
        maxOutputTokens = 1200
      }
    };

    var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

    using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint);
    httpRequest.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
    httpRequest.Content = new StringContent(
      JsonSerializer.Serialize(requestBody),
      Encoding.UTF8,
      "application/json"
    );

    using var response = await GeminiHttp.SendAsync(httpRequest);
    var rawResponse = await response.Content.ReadAsStringAsync();

    if (!response.IsSuccessStatusCode)
    {
      return BuildLocalFallback(text);
    }

    var jsonText = ExtractGeminiText(rawResponse);
    jsonText = CleanJson(jsonText);

    var parsed = JsonSerializer.Deserialize<AuraAgentResponse>(
      jsonText,
      new JsonSerializerOptions
      {
        PropertyNameCaseInsensitive = true
      }
    );

    if (parsed == null)
    {
      return BuildLocalFallback(text);
    }

    parsed.Mode = string.IsNullOrWhiteSpace(parsed.Mode) ? "gemini_agent" : parsed.Mode;
    parsed.AuraResponse = string.IsNullOrWhiteSpace(parsed.AuraResponse)
      ? parsed.AssistantMessage
      : parsed.AuraResponse;

    return parsed;
  }

  private async Task<AuraAgentResponse> ApplyBusinessRulesAsync(AuraAgentResponse response, string? farmId)
  {
    response.MissingFields ??= new List<string>();

    if (response.Intent != "register_animal")
    {
      response.AuraResponse = response.AssistantMessage;
      return response;
    }

    var tag = NormalizeTag(response.IdentificationTag);

    if (string.IsNullOrWhiteSpace(tag))
    {
      response.Action = "open_animal_registration";
      response.MissingFields.Add("identification_tag");
      response.AssistantMessage = "Listo iniciaremos el registro del animal. Primero necesito el número de arete para validar que no esté repetido.";
      response.AuraResponse = response.AssistantMessage;
      return response;
    }

    var exists = await AnimalExistsByTagAsync(tag, farmId);

    if (exists)
    {
      if (response.WeightKg != null)
      {
        response.Intent = "register_weight";
        response.Action = "open_weight_registration";
        response.AssistantMessage = $"El animal con arete {tag} ya existe en esta finca,. No crearé un duplicado. Abriré control de peso para registrar {response.WeightKg} kilos.";
        response.AuraResponse = response.AssistantMessage;
        response.MissingFields.Clear();
        return response;
      }

      response.Intent = "assistant_response";
      response.Action = "none";
      response.AssistantMessage = $"El animal con arete {tag} ya existe en esta finca,. No se puede registrar dos veces el mismo arete.";
      response.AuraResponse = response.AssistantMessage;
      response.MissingFields.Clear();
      return response;
    }

    response.Intent = "register_animal";
    response.Action = "open_animal_registration";
    response.AssistantMessage = $"Listo el arete {tag} no aparece registrado en esta finca. Abriré el registro de nuevo animal y dejaré los datos preparados para confirmación.";
    response.AuraResponse = response.AssistantMessage;
    response.MissingFields.RemoveAll(f => f == "identification_tag");

    return response;
  }

  private async Task<bool> AnimalExistsByTagAsync(string tag, string? farmId)
  {
    try
    {
      var query = _context.Animals
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(a => a.IdentificationTag.ToUpper() == tag);

      if (!string.IsNullOrWhiteSpace(farmId) && Guid.TryParse(farmId, out var parsedFarmId))
      {
        query = query.Where(a => a.FarmId == parsedFarmId);
      }

      return await query.AnyAsync();
    }
    catch
    {
      // Demo fallback while the real PostgreSQL/Supabase connection is not configured.
      return tag == "302" || tag == "045";
    }
  }

  private string LoadAuraContext()
  {
    var path = Path.Combine(
      _environment.ContentRootPath,
      "..",
      "..",
      "..",
      "fincapp-ai-data",
      "edge-intelligence",
      "aura_agent_context.md"
    );

    if (System.IO.File.Exists(path))
    {
      return System.IO.File.ReadAllText(path);
    }

    return """
    You are AURA, the intelligent farm operations agent of FincApp.
    Speak Spanish with a warm, respectful Colombian rural style.
    Always return valid JSON only.
    """;
  }

  private static string BuildUserPrompt(string text, string? farmId, List<string> history)
  {
    var historyText = history.Count == 0
      ? "No previous conversation."
      : string.Join("\n", history.TakeLast(8));

    return $"""
    Current farm_id: {farmId ?? "all"}

    Short conversation memory:
    {historyText}

    New user voice text:
    {text}

    Return only valid JSON using the required schema.
    Do not use markdown.
    Do not use code fences.
    """;
  }

  private static string ExtractGeminiText(string rawResponse)
  {
    using var document = JsonDocument.Parse(rawResponse);

    var root = document.RootElement;

    if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
    {
      return "{}";
    }

    var first = candidates[0];

    if (!first.TryGetProperty("content", out var content))
    {
      return "{}";
    }

    if (!content.TryGetProperty("parts", out var parts) || parts.GetArrayLength() == 0)
    {
      return "{}";
    }

    if (!parts[0].TryGetProperty("text", out var text))
    {
      return "{}";
    }

    return text.GetString() ?? "{}";
  }

  private static string CleanJson(string value)
  {
    var text = value.Trim();

    if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
    {
      text = text[7..].Trim();
    }

    if (text.StartsWith("```"))
    {
      text = text[3..].Trim();
    }

    if (text.EndsWith("```"))
    {
      text = text[..^3].Trim();
    }

    return text;
  }

  private static AuraAgentResponse BuildLocalFallback(string text)
  {
    var normalized = Normalize(text);
    var tag = DetectTag(normalized);
    var weight = DetectWeight(normalized);
    var breed = DetectBreed(normalized);
    var birthDate = DetectBirthDate(normalized);
    var animalType = DetectAnimalType(normalized, breed);

    if (normalized.Contains("quien eres") || normalized.Contains("hola aura"))
    {
      return new AuraAgentResponse
      {
        Mode = "local_fallback",
        Intent = "assistant_response",
        Action = "none",
        AssistantMessage = "Soy AURA, el Agente Inteligente de Operaciones Agropecuarias de FincApp.",
        AuraResponse = "Soy AURA, el Agente Inteligente de Operaciones Agropecuarias de FincApp.",
        Confidence = "medium"
      };
    }


    if (IsVaccinationCommand(normalized))
    {
      return new AuraAgentResponse
      {
        Mode = "local_fallback",
        Intent = "register_vaccination",
        Action = "open_health_registration",
        AssistantMessage = tag == null
          ? "Listo vamos a registrar la vacunación. Primero necesito el arete del animal y el nombre de la vacuna."
          : $"Listo abriré el registro de salud para dejar la vacunación del animal {tag}.",
        AuraResponse = tag == null
          ? "Listo vamos a registrar la vacunación. Primero necesito el arete del animal y el nombre de la vacuna."
          : $"Listo abriré el registro de salud para dejar la vacunación del animal {tag}.",
        AnimalType = animalType,
        IdentificationTag = tag,
        SymptomsDescription = text,
        Severity = "low",
        Confidence = tag == null ? "medium" : "high",
        MissingFields = tag == null
          ? new List<string> { "identification_tag", "vaccine_name" }
          : new List<string>()
      };
    }

    if (IsAnimalRegistration(normalized))
    {
      return new AuraAgentResponse
      {
        Mode = "local_fallback",
        Intent = "register_animal",
        Action = "validate_animal_tag",
        AssistantMessage = tag == null
          ? "Listo iniciaremos el registro del animal. Primero necesito el número de arete."
          : $"Listo voy a validar si el arete {tag} ya existe en esta finca.",
        AuraResponse = tag == null
          ? "Listo iniciaremos el registro del animal. Primero necesito el número de arete."
          : $"Listo voy a validar si el arete {tag} ya existe en esta finca.",
        AnimalType = animalType,
        IdentificationTag = tag,
        Breed = breed,
        BirthDate = birthDate,
        WeightKg = weight,
        Confidence = tag == null ? "low" : "medium",
        MissingFields = tag == null ? new List<string> { "identification_tag" } : new List<string>(),
        RequiresBackendValidation = true
      };
    }

    if (weight != null)
    {
      return new AuraAgentResponse
      {
        Mode = "local_fallback",
        Intent = "register_weight",
        Action = "open_weight_registration",
        AssistantMessage = tag == null
          ? "puedo registrar el peso, pero me falta el arete del animal."
          : $"Listo abriré control de peso para el animal {tag}.",
        AuraResponse = tag == null
          ? "puedo registrar el peso, pero me falta el arete del animal."
          : $"Listo abriré control de peso para el animal {tag}.",
        AnimalType = animalType,
        IdentificationTag = tag,
        WeightKg = weight,
        Confidence = tag == null ? "low" : "medium",
        MissingFields = tag == null ? new List<string> { "identification_tag" } : new List<string>()
      };
    }

    return new AuraAgentResponse
    {
      Mode = "local_fallback",
      Intent = "unknown",
      Action = "none",
      AssistantMessage = "no entendí bien el comando. Puede decirme: Aura, vamos a registrar un animal con arete 999.",
      AuraResponse = "no entendí bien el comando. Puede decirme: Aura, vamos a registrar un animal con arete 999.",
      Confidence = "low"
    };
  }


  private static bool IsVaccinationCommand(string text)
  {
    return text.Contains("vacuna") ||
        text.Contains("vacunacion") ||
        text.Contains("vacunar") ||
        text.Contains("vacunamos") ||
        text.Contains("aftosa") ||
        text.Contains("brucelosis");
  }

  private static bool IsAnimalRegistration(string text)
  {
    return text.Contains("registrar animal") ||
        text.Contains("registra animal") ||
        text.Contains("vamos a registrar") ||
        text.Contains("nuevo animal") ||
        text.Contains("raza");
  }

  private static string? DetectTag(string text)
  {
    var match = Regex.Match(
      text,
      @"(?:arete|numero|codigo|tag|id|identificacion|placa|chapeta|marquilla)\s+([a-z0-9\-]+)",
      RegexOptions.IgnoreCase
    );

    return match.Success ? match.Groups[1].Value.ToUpperInvariant() : null;
  }

  private static decimal? DetectWeight(string text)
  {
    var match = Regex.Match(
      text,
      @"(\d+(?:[\.,]\d+)?)\s*(?:kilos|kilo|kg|kilogramos|kilogramo)",
      RegexOptions.IgnoreCase
    );

    if (!match.Success) return null;

    var normalized = match.Groups[1].Value.Replace(",", ".");

    return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
      ? value
      : null;
  }

  private static string? DetectBreed(string text)
  {
    var match = Regex.Match(
      text,
      @"raza\s+([a-z0-9áéíóúñ \-]+?)(?:\s+fecha|\s+nacimiento|\s+nacio|\s+peso|\s+pesando|\s+y\s+su\s+peso|$)",
      RegexOptions.IgnoreCase
    );

    if (!match.Success) return null;

    return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(match.Groups[1].Value.Trim());
  }

  private static string? DetectBirthDate(string text)
  {
    var match = Regex.Match(
      text,
      @"(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})",
      RegexOptions.IgnoreCase
    );

    if (!match.Success) return null;

    var day = int.Parse(match.Groups[1].Value);
    var month = MonthNumber(match.Groups[2].Value);
    var year = int.Parse(match.Groups[3].Value);

    return month == 0
      ? null
      : new DateTime(year, month, day).ToString("yyyy-MM-dd");
  }

  private static int MonthNumber(string month)
  {
    return Normalize(month) switch
    {
      "enero" => 1,
      "febrero" => 2,
      "marzo" => 3,
      "abril" => 4,
      "mayo" => 5,
      "junio" => 6,
      "julio" => 7,
      "agosto" => 8,
      "septiembre" => 9,
      "setiembre" => 9,
      "octubre" => 10,
      "noviembre" => 11,
      "diciembre" => 12,
      _ => 0
    };
  }

  private static string? DetectAnimalType(string text, string? breed)
  {
    var b = Normalize(breed ?? "");

    if (text.Contains("vaca") || text.Contains("toro") || text.Contains("ternero") ||
      text.Contains("novillo") || text.Contains("ganado") || text.Contains("bovino") ||
      b.Contains("brahman") || b.Contains("cebu") || b.Contains("holstein") || b.Contains("gyr"))
    {
      return "cattle";
    }

    if (text.Contains("cerdo") || text.Contains("marrano") || text.Contains("puerco"))
    {
      return "swine";
    }

    if (text.Contains("pollo") || text.Contains("gallina") || text.Contains("ave"))
    {
      return "poultry";
    }

    return null;
  }

  private static string NormalizeTag(string? tag)
  {
    return (tag ?? "").Trim().ToUpperInvariant();
  }

  private static string Normalize(string value)
  {
    return value
      .ToLowerInvariant()
      .Replace("á", "a")
      .Replace("é", "e")
      .Replace("í", "i")
      .Replace("ó", "o")
      .Replace("ú", "u")
      .Replace("ñ", "n");
  }

  private static void Remember(string sessionId, string message)
  {
    lock (MemoryLock)
    {
      if (!ConversationMemory.ContainsKey(sessionId))
      {
        ConversationMemory[sessionId] = new List<string>();
      }

      ConversationMemory[sessionId].Add(message);

      if (ConversationMemory[sessionId].Count > 12)
      {
        ConversationMemory[sessionId] = ConversationMemory[sessionId]
          .TakeLast(12)
          .ToList();
      }
    }
  }

  private static List<string> GetHistory(string sessionId)
  {
    lock (MemoryLock)
    {
      return ConversationMemory.TryGetValue(sessionId, out var history)
        ? history.ToList()
        : new List<string>();
    }
  }
}

public class AuraAgentRequest
{
  [JsonPropertyName("text")]
  public string? Text { get; set; }

  [JsonPropertyName("session_id")]
  public string? SessionId { get; set; }

  [JsonPropertyName("farm_id")]
  public string? FarmId { get; set; }
}

public class AuraAgentResponse
{
  [JsonPropertyName("mode")]
  public string Mode { get; set; } = "gemini_agent";

  [JsonPropertyName("intent")]
  public string Intent { get; set; } = "unknown";

  [JsonPropertyName("action")]
  public string Action { get; set; } = "none";

  [JsonPropertyName("assistant_message")]
  public string AssistantMessage { get; set; } = string.Empty;

  [JsonPropertyName("aura_response")]
  public string AuraResponse { get; set; } = string.Empty;

  [JsonPropertyName("animal_type")]
  public string? AnimalType { get; set; }

  [JsonPropertyName("identification_tag")]
  public string? IdentificationTag { get; set; }

  [JsonPropertyName("breed")]
  public string? Breed { get; set; }

  [JsonPropertyName("birth_date")]
  public string? BirthDate { get; set; }

  [JsonPropertyName("weight_kg")]
  public decimal? WeightKg { get; set; }

  [JsonPropertyName("symptoms_description")]
  public string? SymptomsDescription { get; set; }

  [JsonPropertyName("task_description")]
  public string? TaskDescription { get; set; }

  [JsonPropertyName("severity")]
  public string? Severity { get; set; }

  [JsonPropertyName("confidence")]
  public string Confidence { get; set; } = "low";

  [JsonPropertyName("missing_fields")]
  public List<string> MissingFields { get; set; } = new();

  [JsonPropertyName("requires_backend_validation")]
  public bool RequiresBackendValidation { get; set; } = true;

  [JsonPropertyName("raw_text")]
  public string RawText { get; set; } = string.Empty;
}
