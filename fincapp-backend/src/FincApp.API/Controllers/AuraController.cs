using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/aura")]
public class AuraController : ControllerBase
{
  [HttpPost("parse")]
  public IActionResult Parse([FromBody] AuraParseRequest request)
  {
    var rawText = request.Text ?? string.Empty;
    var text = Normalize(rawText);

    var result = new AuraParseResponse
    {
      RawText = rawText,
      Intent = "unknown",
      Confidence = "low"
    };

    if (string.IsNullOrWhiteSpace(text))
    {
      result.MissingFields.Add("raw_text");
      result.AuraResponse = "No escuché ningún comando. Por favor intenta de nuevo.";
      return Ok(result);
    }

    if (IsIdentityQuestion(text))
    {
      result.Intent = "assistant_response";
      result.Confidence = "high";
      result.AuraResponse = "Mi nombre es AURA, el Agente Inteligente de Operaciones Agropecuarias de FincApp. Puedo ayudarte a registrar animales, pesos, alertas de salud y sincronización offline.";
      return Ok(result);
    }

    if (IsOfflineQuestion(text))
    {
      result.Intent = "assistant_response";
      result.Confidence = "high";
      result.AuraResponse = "Sí. FincApp puede trabajar sin internet, guardar registros localmente y sincronizarlos cuando la conexión regrese.";
      return Ok(result);
    }

    result.AnimalType = DetectAnimalType(text);
    result.IdentificationTag = DetectIdentificationTag(text);
    result.WeightKg = DetectWeight(text);
    result.Breed = DetectBreed(text);
    result.BirthDate = DetectBirthDate(text);

    if (result.AnimalType == null && IsCattleBreed(result.Breed))
    {
      result.AnimalType = "cattle";
    }

    var explicitAnimalRegistration = IsExplicitAnimalRegistration(text);

    if (IsHealthCommand(text))
    {
      result.Intent = "register_health_record";
      result.SymptomsDescription = rawText;
      result.Severity = InferSeverity(text);
      result.Confidence = result.IdentificationTag == null ? "medium" : "high";

      if (string.IsNullOrWhiteSpace(result.IdentificationTag))
      {
        result.MissingFields.Add("identification_tag");
      }

      result.AuraResponse = result.MissingFields.Count == 0
        ? $"Abriré el registro de salud para el animal con arete {result.IdentificationTag}."
        : "Entendido. ¿Cuál es el arete o identificación del animal?";

      return Ok(result);
    }

    // Important business rule:
    // If the user explicitly says they want to register an animal,
    // the command must stay as register_animal even if weight is also mentioned.
    if (explicitAnimalRegistration)
    {
      result.Intent = "register_animal";
      result.Confidence = "high";

      if (string.IsNullOrWhiteSpace(result.IdentificationTag))
      {
        result.MissingFields.Add("identification_tag");
      }

      if (result.AnimalType == null && string.IsNullOrWhiteSpace(result.Breed))
      {
        result.MissingFields.Add("animal_type");
      }

      result.AuraResponse = result.MissingFields.Count == 0
        ? $"Abriré el registro de animal para el arete {result.IdentificationTag}. Primero validaré si ya existe en la finca."
        : "Abriré el registro de animal, pero necesito completar los datos faltantes.";

      return Ok(result);
    }

    if (IsWeightCommand(text))
    {
      result.Intent = "register_weight";
      result.Confidence = "high";

      if (string.IsNullOrWhiteSpace(result.IdentificationTag))
      {
        result.MissingFields.Add("identification_tag");
      }

      if (result.WeightKg == null)
      {
        result.MissingFields.Add("weight_kg");
      }

      result.AuraResponse = result.MissingFields.Count == 0
        ? $"Abriré control de peso para registrar {result.WeightKg} kilos al animal con arete {result.IdentificationTag}."
        : "Abriré control de peso, pero me falta el arete del animal o el peso en kilos.";

      return Ok(result);
    }

    if (IsTaskCommand(text))
    {
      result.Intent = "register_task";
      result.TaskDescription = rawText;
      result.Confidence = "medium";
      result.AuraResponse = "Abriré el registro de actividades para dejar esta tarea lista.";
      return Ok(result);
    }

    result.Intent = "unknown";
    result.Confidence = "low";
    result.AuraResponse = "No estoy segura de cómo procesar ese comando. Puedes decir: Aura, vamos a registrar un animal con arete 302.";

    return Ok(result);
  }

  [HttpPost("/api/v1/aura/parse")]
  public IActionResult ParseV1([FromBody] AuraParseRequest request)
  {
    return Parse(request);
  }

  private static bool IsIdentityQuestion(string text)
  {
    return text.Contains("quien eres") ||
        text.Contains("hola aura") ||
        text.Contains("despierta aura") ||
        text.Trim() == "aura";
  }

  private static bool IsOfflineQuestion(string text)
  {
    return text.Contains("sin internet") ||
        text.Contains("sin conexion") ||
        text.Contains("offline") ||
        text.Contains("trabajar sin");
  }

  private static bool IsExplicitAnimalRegistration(string text)
  {
    var hasRegistrationVerb =
      text.Contains("registrar") ||
      text.Contains("registra") ||
      text.Contains("registro") ||
      text.Contains("nuevo animal") ||
      text.Contains("crear animal");

    var hasAnimalContext =
      text.Contains("animal") ||
      text.Contains("vaca") ||
      text.Contains("toro") ||
      text.Contains("ternero") ||
      text.Contains("novillo") ||
      text.Contains("res") ||
      text.Contains("ganado") ||
      text.Contains("bovino") ||
      text.Contains("cerdo") ||
      text.Contains("marrano") ||
      text.Contains("puerco") ||
      text.Contains("pollo") ||
      text.Contains("gallina") ||
      text.Contains("ave") ||
      text.Contains("raza");

    return hasRegistrationVerb && hasAnimalContext;
  }

  private static bool IsWeightCommand(string text)
  {
    return text.Contains("peso") ||
        text.Contains("pesa") ||
        text.Contains("pesaje") ||
        text.Contains("kilo") ||
        text.Contains("kg") ||
        text.Contains("kilogramo");
  }

  private static bool IsHealthCommand(string text)
  {
    return text.Contains("fiebre") ||
        text.Contains("sangre") ||
        text.Contains("sangrado") ||
        text.Contains("diarrea") ||
        text.Contains("vomito") ||
        text.Contains("tos") ||
        text.Contains("cojo") ||
        text.Contains("cojera") ||
        text.Contains("inflamacion") ||
        text.Contains("no come") ||
        text.Contains("decaido") ||
        text.Contains("debil") ||
        text.Contains("herida");
  }

  private static bool IsTaskCommand(string text)
  {
    return text.Contains("tarea") ||
        text.Contains("actividad") ||
        text.Contains("repare") ||
        text.Contains("arregle") ||
        text.Contains("limpieza") ||
        text.Contains("corral") ||
        text.Contains("alimento");
  }

  private static string? DetectAnimalType(string text)
  {
    if (
      text.Contains("vaca") ||
      text.Contains("toro") ||
      text.Contains("ternero") ||
      text.Contains("novillo") ||
      text.Contains("res") ||
      text.Contains("ganado") ||
      text.Contains("bovino") ||
      text.Contains("brahman") ||
      text.Contains("cebu") ||
      text.Contains("holstein") ||
      text.Contains("gyr")
    )
    {
      return "cattle";
    }

    if (
      text.Contains("cerdo") ||
      text.Contains("marrano") ||
      text.Contains("puerco") ||
      text.Contains("porcino") ||
      text.Contains("lechon")
    )
    {
      return "swine";
    }

    if (
      text.Contains("pollo") ||
      text.Contains("gallina") ||
      text.Contains("gallo") ||
      text.Contains("ave") ||
      text.Contains("aves") ||
      text.Contains("ponedora")
    )
    {
      return "poultry";
    }

    return null;
  }

  private static string? DetectIdentificationTag(string text)
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

    if (!match.Success)
    {
      match = Regex.Match(
        text,
        @"(?:peso|pesa|peso de|pesando|su peso es de)\s+(\d+(?:[\.,]\d+)?)",
        RegexOptions.IgnoreCase
      );
    }

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
      @"raza\s+([a-z0-9áéíóúñ\- ]+?)(?:\s+fecha|\s+nacimiento|\s+nacio|\s+peso|\s+pesando|\s+y\s+su\s+peso|$)",
      RegexOptions.IgnoreCase
    );

    if (!match.Success) return null;

    var breed = match.Groups[1].Value.Trim();

    return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(breed);
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

    if (month == 0) return null;

    return new DateTime(year, month, day).ToString("yyyy-MM-dd");
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

  private static bool IsCattleBreed(string? breed)
  {
    var text = Normalize(breed ?? "");

    return text.Contains("brahman") ||
        text.Contains("cebu") ||
        text.Contains("holstein") ||
        text.Contains("gyr") ||
        text.Contains("jersey") ||
        text.Contains("simmental");
  }

  private static string InferSeverity(string text)
  {
    if (
      text.Contains("fiebre") ||
      text.Contains("sangre") ||
      text.Contains("sangrado") ||
      text.Contains("no come") ||
      text.Contains("dificultad para respirar") ||
      text.Contains("herida profunda")
    )
    {
      return "high";
    }

    if (
      text.Contains("diarrea") ||
      text.Contains("vomito") ||
      text.Contains("tos") ||
      text.Contains("cojo") ||
      text.Contains("cojera") ||
      text.Contains("inflamacion") ||
      text.Contains("decaido") ||
      text.Contains("debil")
    )
    {
      return "medium";
    }

    return "low";
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
}

public class AuraParseRequest
{
  [JsonPropertyName("text")]
  public string? Text { get; set; }
}

public class AuraParseResponse
{
  [JsonPropertyName("intent")]
  public string Intent { get; set; } = "unknown";

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

  [JsonPropertyName("raw_text")]
  public string RawText { get; set; } = string.Empty;

  [JsonPropertyName("aura_response")]
  public string AuraResponse { get; set; } = string.Empty;
}
