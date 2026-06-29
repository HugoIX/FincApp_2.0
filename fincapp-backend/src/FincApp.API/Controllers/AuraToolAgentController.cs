using System.Globalization;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/aura")]
public class AuraToolAgentController : ControllerBase
{
    private static readonly HttpClient Http = new();
    private static readonly Dictionary<string, List<string>> Memory = new();
    private static readonly Dictionary<string, AuraToolAgentResponse> LastReportBySession = new();
    private static readonly object MemoryLock = new();

    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly FincAppDbContext _context;

    public AuraToolAgentController(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        FincAppDbContext context)
    {
        _configuration = configuration;
        _environment = environment;
        _context = context;
    }

    [HttpPost("tool-agent")]
    public async Task<IActionResult> ToolAgent([FromBody] AuraToolAgentRequest request)
    {
        var text = request.Text?.Trim() ?? string.Empty;
        var sessionId = string.IsNullOrWhiteSpace(request.SessionId)
            ? "default"
            : request.SessionId.Trim();

        if (string.IsNullOrWhiteSpace(text))
        {
            return Ok(AuraToolAgentResponse.Say(
                "No logré escuchar una solicitud. Intente nuevamente cuando esté listo."
            ));
        }

        AuraToolAgentResponse decision;

        var contextualFollowUp = TryBuildContextualFollowUp(text, sessionId);
        var systemSnapshotAnswer = contextualFollowUp == null
            ? await TryBuildSystemSnapshotAnswerAsync(text, request.FarmId)
            : null;

        if (contextualFollowUp != null)
        {
            decision = contextualFollowUp;
        }
        else if (systemSnapshotAnswer != null)
        {
            decision = systemSnapshotAnswer;
        }
        else
        {
            try
            {
                decision = await AskGeminiForToolAsync(text, sessionId, request.FarmId);
            }
            catch
            {
                decision = BuildLocalToolDecision(text, request.FarmId);
            }
        }

        if (string.IsNullOrWhiteSpace(decision.ToolName) || decision.ToolName == "unknown")
        {
            decision = BuildLocalToolDecision(text, request.FarmId);
        }

        decision.RawText = text;
        decision = await ExecuteBusinessRulesAsync(decision, request.FarmId);
        decision = CleanResponseText(decision);

        SaveLastReportIfNeeded(sessionId, decision);

        Remember(sessionId, $"USER: {text}");
        Remember(sessionId, $"AURA_TOOL: {JsonSerializer.Serialize(decision)}");

        return Ok(decision);
    }

    private async Task<AuraToolAgentResponse> AskGeminiForToolAsync(string text, string sessionId, string? farmId)
    {
        var apiKey = _configuration["Gemini:ApiKey"];
        var model = _configuration["Gemini:Model"] ?? "gemini-3.5-flash";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return BuildLocalToolDecision(text, farmId);
        }

        if (model.StartsWith("models/", StringComparison.OrdinalIgnoreCase))
        {
            model = model.Replace("models/", "", StringComparison.OrdinalIgnoreCase);
        }

        var systemContext = LoadContext();
        var history = GetHistory(sessionId);

        var jsonShape = """
        {
          "mode": "aura_tool_agent",
          "tool_name": "string",
          "tool_args": {},
          "action": "string",
          "ui_action": "string",
          "intent": "string",
          "assistant_message": "string",
          "audio_text": "string",
          "needs_confirmation": true,
          "missing_fields": [],
          "tool_result": {},
          "recommended_actions": [],
          "confidence": "low | medium | high",
          "raw_text": "original user text"
        }
        """;

        var recentConversation = history.Count == 0
            ? "No previous conversation."
            : string.Join("\n", history.TakeLast(8));

        var prompt = string.Join("\n", new[]
        {
            $"Current farm_id: {farmId ?? "all"}",
            "",
            "Recent conversation:",
            recentConversation,
            "",
            "User voice text:",
            text,
            "",
            "Choose exactly one AURA tool from the tools contract.",
            "Return valid JSON only.",
            "Do not use markdown.",
            "Do not use code fences.",
            "",
            "Required JSON shape:",
            jsonShape
        });

        var requestBody = new
        {
            systemInstruction = new
            {
                parts = new[]
                {
                    new { text = systemContext }
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
                temperature = 0.22,
                maxOutputTokens = 1400
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

        using var response = await Http.SendAsync(httpRequest);
        var raw = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            return BuildLocalToolDecision(text, farmId);
        }

        var json = ExtractGeminiText(raw);
        json = CleanJson(json);

        var parsed = JsonSerializer.Deserialize<AuraToolAgentResponse>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
        );

        return parsed ?? BuildLocalToolDecision(text, farmId);
    }

    private async Task<AuraToolAgentResponse> ExecuteBusinessRulesAsync(AuraToolAgentResponse response, string? farmId)
    {
        response.Mode = "aura_tool_agent";
        response.ToolArgs ??= new Dictionary<string, object?>();
        response.MissingFields ??= new List<string>();
        response.RecommendedActions ??= new List<string>();
        response.ToolResult ??= new Dictionary<string, object?>();

        var rawTextNormalized = Normalize(response.RawText);

        // Contextual answers must not be converted into registration or report tools.
        // This is what makes AURA behave more like an agent and less like a command bot.
        if (
            response.ToolName == "answer_from_context" ||
            response.ToolName == "system_data_snapshot" ||
            response.Intent == "contextual_recommendation" ||
            response.Intent == "system_status_question"
        )
        {
            response.Action = string.IsNullOrWhiteSpace(response.Action) || response.Action == "none"
                ? "show_aura_report"
                : response.Action;

            response.UiAction = string.IsNullOrWhiteSpace(response.UiAction) || response.UiAction == "none"
                ? response.Action
                : response.UiAction;

            response.AssistantMessage = string.IsNullOrWhiteSpace(response.AssistantMessage)
                ? "Responderé con base en la información disponible del sistema."
                : response.AssistantMessage;

            response.AudioText = string.IsNullOrWhiteSpace(response.AudioText)
                ? response.AssistantMessage
                : response.AudioText;

            response.NeedsConfirmation = false;
            return response;
        }

        // Deterministic priority overrides.
        // Reports must win over registration tools when the user asks to analyze or review data.
        if (ContainsAny(
            rawTextNormalized,
            "ganancia de peso",
            "ganancias de peso",
            "reporte de peso",
            "reportes de peso",
            "analisis de peso",
            "analitica de peso",
            "como van los reportes de ganancia",
            "como van los pesos",
            "animales han perdido peso",
            "animales han ganado peso",
            "rendimiento de peso",
            "perdida de peso",
            "perdida peso",
            "perdio peso",
            "bajo de peso",
            "bajando de peso"
        ))
        {
            response.ToolName = "generate_weight_gain_report";
            response.Intent = "generate_report";
            response.Action = "show_weight_gain_report";
            response.UiAction = response.Action;
            response.ToolArgs = new Dictionary<string, object?>();
            response.MissingFields.Clear();
        }
        else if (ContainsAny(
            rawTextNormalized,
            "reporte de salud",
            "reportes de salud",
            "analisis de salud",
            "alertas de salud",
            "estado de salud"
        ))
        {
            response.ToolName = "generate_health_report";
            response.Intent = "generate_report";
            response.Action = "show_health_report";
            response.UiAction = response.Action;
            response.ToolArgs = new Dictionary<string, object?>();
            response.MissingFields.Clear();
        }
        else if (ContainsAny(
            rawTextNormalized,
            "reporte de inventario",
            "resumen de inventario",
            "analisis de inventario",
            "estado del inventario"
        ))
        {
            response.ToolName = "generate_inventory_report";
            response.Intent = "generate_report";
            response.Action = "show_inventory_report";
            response.UiAction = response.Action;
            response.ToolArgs = new Dictionary<string, object?>();
            response.MissingFields.Clear();
        }
        else
        {
            response.ToolName = NormalizeToolName(response.ToolName, response.Intent, response.Action);
            response.Action = NormalizeAction(response.ToolName, response.Action);
            response.UiAction = response.Action;
        }

        var tag = GetStringArg(response, "identification_tag");
        var weight = GetDecimalArg(response, "weight_kg");

        switch (response.ToolName)
        {
            case "validate_animal_tag":
            case "register_animal_draft":
            {
                if (string.IsNullOrWhiteSpace(tag))
                {
                    response.MissingFields.Add("identification_tag");
                    response.Action = "open_animal_registration";
                    response.UiAction = response.Action;
                    response.AssistantMessage = "Entendido. Para iniciar el registro del animal necesito el número de arete.";
                    response.AudioText = response.AssistantMessage;
                    response.NeedsConfirmation = true;
                    return response;
                }

                var exists = await AnimalExistsByTagAsync(tag, farmId);

                response.ToolResult["identification_tag"] = tag;
                response.ToolResult["exists"] = exists;

                if (exists && weight != null)
                {
                    response.ToolName = "register_weight_draft";
                    response.Intent = "register_weight";
                    response.Action = "open_weight_registration";
                    response.UiAction = response.Action;
                    response.AssistantMessage = $"El animal con arete {tag} ya se encuentra registrado. No crearé un registro duplicado. Abriré control de peso para preparar el pesaje de {weight} kilogramos.";
                    response.AudioText = response.AssistantMessage;
                    response.NeedsConfirmation = true;
                    return response;
                }

                if (exists)
                {
                    response.ToolName = "search_animal_by_tag";
                    response.Intent = "search_animal";
                    response.Action = "open_inventory";
                    response.UiAction = response.Action;
                    response.AssistantMessage = $"El animal con arete {tag} ya se encuentra registrado. No crearé un registro duplicado. Abriré el inventario para consultarlo.";
                    response.AudioText = response.AssistantMessage;
                    response.NeedsConfirmation = false;
                    return response;
                }

                response.ToolName = "register_animal_draft";
                response.Intent = "register_animal";
                response.Action = "open_animal_registration";
                response.UiAction = response.Action;
                response.AssistantMessage = $"Validé el arete {tag}. No aparece registrado en esta finca. Abriré el registro de nuevo animal y dejaré los datos preparados para confirmación.";
                response.AudioText = response.AssistantMessage;
                response.NeedsConfirmation = true;
                return response;
            }

            case "generate_weight_gain_report":
            {
                var report = await BuildWeightGainReportAsync(farmId);
                response.Action = "show_weight_gain_report";
                response.UiAction = response.Action;
                response.ToolResult = report.ToolResult;
                response.RecommendedActions = report.RecommendedActions;
                response.AssistantMessage = report.AssistantMessage;
                response.AudioText = response.AssistantMessage;
                response.NeedsConfirmation = false;
                return response;
            }

            case "generate_inventory_report":
            {
                var report = await BuildInventoryReportAsync(farmId);
                response.Action = "show_inventory_report";
                response.UiAction = response.Action;
                response.ToolResult = report.ToolResult;
                response.RecommendedActions = report.RecommendedActions;
                response.AssistantMessage = report.AssistantMessage;
                response.AudioText = response.AssistantMessage;
                response.NeedsConfirmation = false;
                return response;
            }

            case "generate_health_report":
            {
                var report = await BuildHealthReportAsync(farmId);
                response.Action = "show_health_report";
                response.UiAction = response.Action;
                response.ToolResult = report.ToolResult;
                response.RecommendedActions = report.RecommendedActions;
                response.AssistantMessage = report.AssistantMessage;
                response.AudioText = response.AssistantMessage;
                response.NeedsConfirmation = false;
                return response;
            }

            case "export_inventory_pdf":
            {
                response.Action = "export_inventory_pdf";
                response.UiAction = response.Action;
                response.AssistantMessage = "Generaré el PDF del inventario con la información disponible.";
                response.AudioText = response.AssistantMessage;
                response.NeedsConfirmation = false;
                return response;
            }

            case "register_activity_draft":
            {
                response.Action = "open_activity_registration";
                response.UiAction = response.Action;
                response.NeedsConfirmation = true;

                if (string.IsNullOrWhiteSpace(GetStringArg(response, "task_description")))
                {
                    response.ToolArgs["task_description"] = response.RawText;
                }

                response.AssistantMessage = "Abriré el módulo de actividades y dejaré la información preparada para confirmación.";
                response.AudioText = response.AssistantMessage;
                return response;
            }

            case "register_health_record_draft":
            {
                response.Action = "open_health_registration";
                response.UiAction = response.Action;
                response.NeedsConfirmation = true;

                if (string.IsNullOrWhiteSpace(GetStringArg(response, "symptoms_description")))
                {
                    response.ToolArgs["symptoms_description"] = response.RawText;
                }

                response.AssistantMessage = "Abriré el módulo de salud y dejaré el registro preparado para confirmación.";
                response.AudioText = response.AssistantMessage;
                return response;
            }

            case "register_weight_draft":
            {
                response.Action = "open_weight_registration";
                response.UiAction = response.Action;
                response.NeedsConfirmation = true;

                if (string.IsNullOrWhiteSpace(tag))
                {
                    response.MissingFields.Add("identification_tag");
                    response.AssistantMessage = "Para preparar el registro de peso necesito el número de arete.";
                    response.AudioText = response.AssistantMessage;
                    return response;
                }

                if (weight == null)
                {
                    response.MissingFields.Add("weight_kg");
                    response.AssistantMessage = "Para preparar el registro de peso necesito el valor en kilogramos.";
                    response.AudioText = response.AssistantMessage;
                    return response;
                }

                response.AssistantMessage = $"Abriré control de peso y prepararé el pesaje de {weight} kilogramos para el animal con arete {tag}.";
                response.AudioText = response.AssistantMessage;
                return response;
            }

            case "search_animal_by_tag":
            {
                response.Action = "search_animal";
                response.UiAction = response.Action;

                if (string.IsNullOrWhiteSpace(tag))
                {
                    response.MissingFields.Add("identification_tag");
                    response.AssistantMessage = "Para buscar el animal necesito el número de arete.";
                    response.AudioText = response.AssistantMessage;
                    return response;
                }

                var exists = await AnimalExistsByTagAsync(tag, farmId);
                response.ToolResult["identification_tag"] = tag;
                response.ToolResult["exists"] = exists;
                response.AssistantMessage = exists
                    ? $"Encontré el animal con arete {tag}. Abriré el inventario para consultarlo."
                    : $"No encontré un animal con arete {tag} en la información disponible.";
                response.AudioText = response.AssistantMessage;
                return response;
            }

            case "open_module":
            {
                var module = GetStringArg(response, "module") ?? GetStringArg(response, "target_module") ?? "dashboard";
                response.Action = ModuleToAction(module);
                response.UiAction = response.Action;
                response.AssistantMessage = $"Abriré el módulo de {ModuleLabel(module)}.";
                response.AudioText = response.AssistantMessage;
                return response;
            }

            default:
            {
                response.Action = "none";
                response.UiAction = "none";
                response.AssistantMessage = string.IsNullOrWhiteSpace(response.AssistantMessage)
                    ? "No logré asociar la solicitud con una herramienta disponible de FincApp."
                    : response.AssistantMessage;
                response.AudioText = response.AssistantMessage;
                return response;
            }
        }
    }

    private AuraToolAgentResponse BuildLocalToolDecision(string text, string? farmId)
    {
        var normalized = Normalize(text);
        var tag = DetectTag(normalized);
        var weight = DetectWeight(normalized);
        var breed = DetectBreed(normalized);
        var birthDate = DetectBirthDate(normalized);

        if (ContainsAny(normalized, "ganancia de peso", "perdido peso", "perdida de peso", "reporte de peso", "reportes de peso"))
        {
            return new AuraToolAgentResponse
            {
                ToolName = "generate_weight_gain_report",
                Intent = "generate_report",
                Action = "show_weight_gain_report",
                AssistantMessage = "Generaré el reporte de ganancia de peso con la información disponible.",
                AudioText = "Generaré el reporte de ganancia de peso con la información disponible.",
                Confidence = "medium",
                RawText = text
            };
        }

        if (ContainsAny(normalized, "reporte de salud", "alertas de salud", "estado de salud"))
        {
            return new AuraToolAgentResponse
            {
                ToolName = "generate_health_report",
                Intent = "generate_report",
                Action = "show_health_report",
                AssistantMessage = "Generaré el reporte de salud animal con la información disponible.",
                AudioText = "Generaré el reporte de salud animal con la información disponible.",
                Confidence = "medium",
                RawText = text
            };
        }

        if (ContainsAny(normalized, "exporta", "exportar", "descarga", "pdf", "listado de animales"))
        {
            if (ContainsAny(normalized, "inventario", "animales", "ganado", "listado"))
            {
                return new AuraToolAgentResponse
                {
                    ToolName = "export_inventory_pdf",
                    Intent = "export_inventory",
                    Action = "export_inventory_pdf",
                    AssistantMessage = "Generaré el PDF del inventario con la información disponible.",
                    AudioText = "Generaré el PDF del inventario con la información disponible.",
                    Confidence = "high",
                    RawText = text
                };
            }
        }

        if (ContainsAny(normalized, "registrar animal", "registra animal", "nuevo animal", "vamos a registrar") || ContainsAny(normalized, "raza"))
        {
            return new AuraToolAgentResponse
            {
                ToolName = "register_animal_draft",
                Intent = "register_animal",
                Action = "open_animal_registration",
                ToolArgs = new Dictionary<string, object?>
                {
                    ["identification_tag"] = tag,
                    ["breed"] = breed,
                    ["birth_date"] = birthDate,
                    ["weight_kg"] = weight,
                    ["animal_type"] = DetectAnimalType(normalized, breed),
                    ["farm_id"] = farmId ?? "all"
                },
                AssistantMessage = "Validaré los datos del animal antes de preparar el registro.",
                AudioText = "Validaré los datos del animal antes de preparar el registro.",
                Confidence = tag == null ? "medium" : "high",
                RawText = text
            };
        }

        if (ContainsAny(normalized, "vacuna", "vacunacion", "vacunación", "desparas", "medicamento", "tratamiento", "fiebre", "diarrea", "herida", "no come"))
        {
            return new AuraToolAgentResponse
            {
                ToolName = "register_health_record_draft",
                Intent = "register_health_record",
                Action = "open_health_registration",
                ToolArgs = new Dictionary<string, object?>
                {
                    ["identification_tag"] = tag,
                    ["symptoms_description"] = text,
                    ["severity"] = InferSeverity(normalized),
                    ["farm_id"] = farmId ?? "all"
                },
                AssistantMessage = "Abriré el módulo de salud y dejaré el registro preparado para confirmación.",
                AudioText = "Abriré el módulo de salud y dejaré el registro preparado para confirmación.",
                Confidence = "medium",
                RawText = text
            };
        }

        if (weight != null)
        {
            return new AuraToolAgentResponse
            {
                ToolName = "register_weight_draft",
                Intent = "register_weight",
                Action = "open_weight_registration",
                ToolArgs = new Dictionary<string, object?>
                {
                    ["identification_tag"] = tag,
                    ["weight_kg"] = weight,
                    ["farm_id"] = farmId ?? "all"
                },
                AssistantMessage = "Prepararé el registro de peso con la información disponible.",
                AudioText = "Prepararé el registro de peso con la información disponible.",
                Confidence = tag == null ? "medium" : "high",
                RawText = text
            };
        }

        if (ContainsAny(normalized, "actividad", "tarea", "limpiar", "limpieza", "corral", "reparar", "mantenimiento", "alimento", "alimentacion", "cerca"))
        {
            return new AuraToolAgentResponse
            {
                ToolName = "register_activity_draft",
                Intent = "register_activity",
                Action = "open_activity_registration",
                ToolArgs = new Dictionary<string, object?>
                {
                    ["task_description"] = text,
                    ["farm_id"] = farmId ?? "all"
                },
                AssistantMessage = "Abriré el módulo de actividades y dejaré la información preparada para confirmación.",
                AudioText = "Abriré el módulo de actividades y dejaré la información preparada para confirmación.",
                Confidence = "medium",
                RawText = text
            };
        }

        if (ContainsAny(normalized, "inventario", "ganado", "animales"))
        {
            return OpenModule("inventory", text);
        }

        if (ContainsAny(normalized, "dashboard", "inicio", "resumen"))
        {
            return OpenModule("dashboard", text);
        }

        if (ContainsAny(normalized, "peso", "pesos", "pesaje"))
        {
            return OpenModule("weights", text);
        }

        if (ContainsAny(normalized, "salud"))
        {
            return OpenModule("health", text);
        }

        if (ContainsAny(normalized, "reporte", "reportes", "informe"))
        {
            return OpenModule("reports", text);
        }

        return AuraToolAgentResponse.Say(
            "No logré asociar la solicitud con una herramienta disponible de FincApp.",
            text
        );
    }

    private async Task<bool> AnimalExistsByTagAsync(string tag, string? farmId)
    {
        var normalizedTag = tag.Trim().ToUpperInvariant();

        try
        {
            var query = _context.Animals
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(a => a.IdentificationTag.ToUpper() == normalizedTag);

            if (!string.IsNullOrWhiteSpace(farmId) && Guid.TryParse(farmId, out var parsedFarmId))
            {
                query = query.Where(a => a.FarmId == parsedFarmId);
            }

            return await query.AnyAsync();
        }
        catch
        {
            return normalizedTag == "302" || normalizedTag == "045";
        }
    }

    private async Task<ReportResult> BuildWeightGainReportAsync(string? farmId)
    {
        try
        {
            var animalsQuery = _context.Animals
                .IgnoreQueryFilters()
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(farmId) && Guid.TryParse(farmId, out var parsedFarmId))
            {
                animalsQuery = animalsQuery.Where(a => a.FarmId == parsedFarmId);
            }

            var animals = await animalsQuery.ToListAsync();

            if (animals.Count == 0)
            {
                return DemoWeightGainReport();
            }

            var animalIds = animals.Select(a => a.Id).ToHashSet();

            var weights = await _context.WeightLogs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(w => animalIds.Contains(w.AnimalId))
                .OrderBy(w => w.LogDate)
                .ToListAsync();

            var healthRecords = await _context.HealthRecords
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(h => animalIds.Contains(h.AnimalId))
                .OrderByDescending(h => h.RecordedAt)
                .ToListAsync();

            var animalsWithLossDetails = new List<Dictionary<string, object?>>();
            var animalsWithGainDetails = new List<Dictionary<string, object?>>();
            var animalsWithoutRecentWeightDetails = new List<Dictionary<string, object?>>();
            var gains = new List<decimal>();

            var recentCutoff = DateTime.UtcNow.AddDays(-45);

            foreach (var animal in animals)
            {
                var logs = weights
                    .Where(w => w.AnimalId == animal.Id)
                    .OrderBy(w => w.LogDate)
                    .ToList();

                if (logs.Count < 2)
                {
                    animalsWithoutRecentWeightDetails.Add(new Dictionary<string, object?>
                    {
                        ["identification_tag"] = animal.IdentificationTag,
                        ["reason"] = "No tiene suficientes registros de peso para calcular tendencia.",
                        ["weight_logs_count"] = logs.Count
                    });

                    continue;
                }

                var previous = logs[^2];
                var last = logs[^1];
                var diff = last.WeightKg - previous.WeightKg;

                gains.Add(diff);

                var healthAlerts = healthRecords
                    .Where(h => h.AnimalId == animal.Id)
                    .Take(3)
                    .Select(h => new Dictionary<string, object?>
                    {
                        ["recorded_at"] = h.RecordedAt.ToString("yyyy-MM-dd"),
                        ["description"] = h.SymptomsDescription
                    })
                    .ToList();

                var detail = new Dictionary<string, object?>
                {
                    ["identification_tag"] = animal.IdentificationTag,
                    ["previous_weight_kg"] = previous.WeightKg,
                    ["last_weight_kg"] = last.WeightKg,
                    ["difference_kg"] = diff,
                    ["previous_weight_date"] = previous.LogDate.ToString("yyyy-MM-dd"),
                    ["last_weight_date"] = last.LogDate.ToString("yyyy-MM-dd"),
                    ["has_recent_weight"] = last.LogDate >= recentCutoff,
                    ["health_alerts"] = healthAlerts
                };

                if (diff < 0)
                {
                    animalsWithLossDetails.Add(detail);
                }
                else if (diff > 0)
                {
                    animalsWithGainDetails.Add(detail);
                }
            }

            var averageGain = gains.Count == 0 ? 0 : gains.Average();

            var lossCount = animalsWithLossDetails.Count;
            var gainCount = animalsWithGainDetails.Count;
            var withoutRecentCount = animalsWithoutRecentWeightDetails.Count;

            var lossText = lossCount == 1
                ? "1 animal con pérdida de peso"
                : $"{lossCount} animales con pérdida de peso";

            var message = $"El reporte de ganancia de peso está listo. Hay {gainCount} animales con aumento, {lossText} y {withoutRecentCount} sin suficientes pesajes recientes. La ganancia promedio calculada es de {averageGain:0.##} kilogramos.";

            return new ReportResult
            {
                AssistantMessage = message,
                ToolResult = new Dictionary<string, object?>
                {
                    ["total_animals"] = animals.Count,
                    ["animals_with_gain"] = gainCount,
                    ["animals_with_loss"] = lossCount,
                    ["animals_without_recent_weight"] = withoutRecentCount,
                    ["average_gain_kg"] = averageGain,
                    ["animals_with_loss_details"] = animalsWithLossDetails,
                    ["animals_with_gain_details"] = animalsWithGainDetails.Take(5).ToList(),
                    ["animals_without_recent_weight_details"] = animalsWithoutRecentWeightDetails.Take(5).ToList()
                },
                RecommendedActions = new List<string>
                {
                    "Revisar primero animales con pérdida de peso.",
                    "Cruzar los casos con registros de salud recientes.",
                    "Actualizar pesajes pendientes para confirmar tendencias.",
                    "Verificar consumo de alimento y agua en animales con pérdida."
                }
            };
        }
        catch
        {
            return DemoWeightGainReport();
        }
    }

    private static ReportResult DemoWeightGainReport()
    {
        var lossDetails = new List<Dictionary<string, object?>>
        {
            new()
            {
                ["identification_tag"] = "302",
                ["previous_weight_kg"] = 200,
                ["last_weight_kg"] = 180,
                ["difference_kg"] = -20,
                ["previous_weight_date"] = "2026-06-01",
                ["last_weight_date"] = "2026-06-25",
                ["has_recent_weight"] = true,
                ["health_alerts"] = new List<Dictionary<string, object?>>
                {
                    new()
                    {
                        ["recorded_at"] = "2026-06-24",
                        ["description"] = "Revisión pendiente por posible decaimiento."
                    }
                }
            }
        };

        return new ReportResult
        {
            AssistantMessage = "El reporte de ganancia de peso está listo con datos de demostración. La tendencia general es positiva, pero hay 1 animal con pérdida de peso y 2 animales sin pesaje reciente.",
            ToolResult = new Dictionary<string, object?>
            {
                ["total_animals"] = 6,
                ["animals_with_gain"] = 3,
                ["animals_with_loss"] = 1,
                ["animals_without_recent_weight"] = 2,
                ["average_gain_kg"] = 18.5,
                ["animals_with_loss_details"] = lossDetails,
                ["animals_without_recent_weight_details"] = new List<Dictionary<string, object?>>
                {
                    new()
                    {
                        ["identification_tag"] = "045",
                        ["reason"] = "No tiene suficientes registros recientes de peso.",
                        ["weight_logs_count"] = 1
                    },
                    new()
                    {
                        ["identification_tag"] = "118",
                        ["reason"] = "No tiene pesaje reciente registrado.",
                        ["weight_logs_count"] = 0
                    }
                }
            },
            RecommendedActions = new List<string>
            {
                "Revisar primero el animal con arete 302 por pérdida de peso.",
                "Validar consumo de alimento y agua.",
                "Cruzar el caso con registros de salud recientes.",
                "Actualizar pesajes de animales sin registro reciente."
            }
        };
    }

    private async Task<ReportResult> BuildInventoryReportAsync(string? farmId)
    {
        try
        {
            var animals = await _context.Animals
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync();

            var byType = animals
                .GroupBy(a => a.Type.ToString())
                .ToDictionary(g => g.Key, g => g.Count());

            return new ReportResult
            {
                AssistantMessage = $"El inventario tiene {animals.Count} animales registrados. Preparé el resumen por tipo de producción.",
                ToolResult = new Dictionary<string, object?>
                {
                    ["total_animals"] = animals.Count,
                    ["animals_by_type"] = byType
                },
                RecommendedActions = new List<string>
                {
                    "Verificar animales con datos incompletos.",
                    "Exportar el inventario antes del cierre de entrega.",
                    "Validar que cada animal tenga arete único."
                }
            };
        }
        catch
        {
            return new ReportResult
            {
                AssistantMessage = "El inventario de demostración tiene 6 animales registrados, distribuidos entre bovinos, porcinos y aves.",
                ToolResult = new Dictionary<string, object?>
                {
                    ["total_animals"] = 6,
                    ["cattle"] = 3,
                    ["swine"] = 2,
                    ["poultry"] = 1
                },
                RecommendedActions = new List<string>
                {
                    "Validar aretes únicos.",
                    "Completar pesos y fechas de nacimiento faltantes."
                }
            };
        }
    }

    private async Task<ReportResult> BuildHealthReportAsync(string? farmId)
    {
        try
        {
            var records = await _context.HealthRecords
                .IgnoreQueryFilters()
                .AsNoTracking()
                .OrderByDescending(h => h.RecordedAt)
                .Take(20)
                .ToListAsync();

            var highRisk = records.Count(r =>
                Normalize(r.SymptomsDescription ?? "").Contains("fiebre") ||
                Normalize(r.SymptomsDescription ?? "").Contains("sangre") ||
                Normalize(r.SymptomsDescription ?? "").Contains("no come")
            );

            return new ReportResult
            {
                AssistantMessage = $"El reporte de salud está listo. Hay {records.Count} registros recientes y {highRisk} casos que podrían requerir prioridad.",
                ToolResult = new Dictionary<string, object?>
                {
                    ["recent_health_records"] = records.Count,
                    ["possible_high_risk_cases"] = highRisk
                },
                RecommendedActions = new List<string>
                {
                    "Priorizar animales con fiebre, sangre o falta de apetito.",
                    "Actualizar tratamientos y vacunaciones pendientes.",
                    "Revisar si las alertas coinciden con pérdida de peso."
                }
            };
        }
        catch
        {
            return new ReportResult
            {
                AssistantMessage = "El reporte de salud de demostración muestra 2 alertas activas, una de prioridad alta y una de prioridad media.",
                ToolResult = new Dictionary<string, object?>
                {
                    ["active_alerts"] = 2,
                    ["high_priority"] = 1,
                    ["medium_priority"] = 1
                },
                RecommendedActions = new List<string>
                {
                    "Revisar primero los casos de fiebre o falta de apetito.",
                    "Completar registros de tratamiento."
                }
            };
        }
    }

    private static AuraToolAgentResponse CleanResponseText(AuraToolAgentResponse response)
    {
        response.AssistantMessage = CleanTextSpacing(response.AssistantMessage);
        response.AudioText = CleanTextSpacing(response.AudioText);

        // Prefer the cleanest spoken text also as visible message.
        if (!string.IsNullOrWhiteSpace(response.AudioText))
        {
            response.AssistantMessage = CleanTextSpacing(response.AudioText);
        }

        if (response.RecommendedActions != null)
        {
            response.RecommendedActions = response.RecommendedActions
                .Select(CleanTextSpacing)
                .ToList();
        }

        if (response.ToolResult != null)
        {
            response.ToolResult = CleanDictionaryStrings(response.ToolResult);
        }

        if (response.ToolArgs != null)
        {
            response.ToolArgs = CleanDictionaryStrings(response.ToolArgs);
        }

        return response;
    }

    private static Dictionary<string, object?> CleanDictionaryStrings(Dictionary<string, object?> values)
    {
        try
        {
            var json = JsonSerializer.Serialize(values);
            json = CleanTextSpacing(json);

            return JsonSerializer.Deserialize<Dictionary<string, object?>>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            ) ?? values;
        }
        catch
        {
            var cleaned = new Dictionary<string, object?>();

            foreach (var item in values)
            {
                cleaned[item.Key] = item.Value is string text
                    ? CleanTextSpacing(text)
                    : item.Value;
            }

            return cleaned;
        }
    }

    private static string CleanTextSpacing(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var text = value;

        var replacements = new Dictionary<string, string>
        {
            ["listocon"] = "listo con",
            ["Listocon"] = "Listo con",

            ["pesajereciente"] = "pesaje reciente",
            ["Pesajereciente"] = "Pesaje reciente",

            ["pérdidade"] = "pérdida de",
            ["Pérdidade"] = "Pérdida de",
            ["perdidade"] = "pérdida de",
            ["Perdidade"] = "Pérdida de",

            ["alertasde"] = "alertas de",
            ["Alertasde"] = "Alertas de",

            ["datosde"] = "datos de",
            ["Datosde"] = "Datos de",

            ["registrosde"] = "registros de",
            ["Registrosde"] = "Registros de",

            ["animalescon"] = "animales con",
            ["Animalescon"] = "Animales con",

            ["sinpesaje"] = "sin pesaje",
            ["Sinpesaje"] = "Sin pesaje",

            ["unnuevo"] = "un nuevo",
            ["Unnuevo"] = "Un nuevo",

            ["presentapérdida"] = "presenta pérdida",
            ["Presentapérdida"] = "Presenta pérdida",

            ["1animal"] = "1 animal",
            ["1Animal"] = "1 Animal"
        };

        foreach (var pair in replacements)
        {
            text = text.Replace(pair.Key, pair.Value);
        }

        text = Regex.Replace(text, @"([.!?])(?=[A-Za-zÁÉÍÓÚáéíóúÑñ])", "$1 ");
        text = Regex.Replace(text, @"\s+", " ").Trim();

        return text;
    }


    private static AuraToolAgentResponse? TryBuildContextualFollowUp(string text, string sessionId)
    {
        var normalized = Normalize(text);

        var looksLikeFollowUp =
            ContainsAny(
                normalized,
                "recomendacion",
                "recomendaciones",
                "que me recomiendas",
                "que recomendaciones",
                "que hago",
                "que debo hacer",
                "entonces",
                "por que",
                "porque",
                "explicame",
                "que significa",
                "que animal",
                "cual animal",
                "perdida de peso",
                "perdio peso",
                "perdida",
                "riesgo"
            );

        if (!looksLikeFollowUp)
            return null;

        AuraToolAgentResponse? lastReport = null;

        lock (MemoryLock)
        {
            LastReportBySession.TryGetValue(sessionId, out lastReport);
        }

        if (lastReport == null)
            return null;

        var lastTool = lastReport.ToolName ?? "";
        var result = lastReport.ToolResult ?? new Dictionary<string, object?>();
        var actions = lastReport.RecommendedActions ?? new List<string>();

        if (lastTool == "generate_weight_gain_report")
        {
            var total = GetObjectValue(result, "total_animals", "0");
            var withLoss = GetObjectValue(result, "animals_with_loss", "0");
            var withoutRecent = GetObjectValue(result, "animals_without_recent_weight", "0");
            var averageGain = GetObjectValue(result, "average_gain_kg", "0");
            var focusAnimal = GetFirstDictionaryListItem(result, "animals_with_loss_details");

            string message;

            if (focusAnimal != null)
            {
                var tag = GetObjectValue(focusAnimal, "identification_tag", "sin arete");
                var previousWeight = GetObjectValue(focusAnimal, "previous_weight_kg", "sin dato");
                var lastWeight = GetObjectValue(focusAnimal, "last_weight_kg", "sin dato");
                var difference = GetObjectValue(focusAnimal, "difference_kg", "sin dato");
                var lastDate = GetObjectValue(focusAnimal, "last_weight_date", "sin fecha");

                message =
                    $"El animal que requiere prioridad es el arete {tag}. Pasó de {previousWeight} kg a {lastWeight} kg, con una variación de {difference} kg registrada hasta {lastDate}. " +
                    "Recomiendo revisar consumo de alimento y agua, condición corporal, signos de enfermedad, cambios recientes de manejo y registros de salud. " +
                    "También conviene compararlo con animales del mismo lote y hacer un nuevo pesaje de control para confirmar si la pérdida continúa.";
            }
            else
            {
                var lossText = withLoss == "1"
                    ? "hay 1 animal con pérdida de peso"
                    : $"hay {withLoss} animales con pérdida de peso";

                message =
                    $"Según el último reporte de ganancia de peso, {lossText} y {withoutRecent} sin pesaje reciente. " +
                    $"La ganancia promedio calculada es de {averageGain} kilogramos. " +
                    "Mi recomendación es revisar primero los animales con pérdida, validar consumo de alimento y agua, revisar signos de enfermedad y actualizar los pesajes pendientes.";
            }

            return new AuraToolAgentResponse
            {
                ToolName = "answer_from_context",
                Intent = "contextual_recommendation",
                Action = "show_aura_report",
                UiAction = "show_aura_report",
                AssistantMessage = message,
                AudioText = message,
                NeedsConfirmation = false,
                Confidence = "high",
                ToolResult = new Dictionary<string, object?>
                {
                    ["context"] = "Último reporte de ganancia de peso",
                    ["total_animals"] = total,
                    ["animals_with_loss"] = withLoss,
                    ["animals_without_recent_weight"] = withoutRecent,
                    ["average_gain_kg"] = averageGain,
                    ["focus_animal"] = focusAnimal
                },
                RecommendedActions = actions.Count > 0
                    ? actions
                    : new List<string>
                    {
                        "Revisar estado de salud del animal con pérdida de peso.",
                        "Actualizar el pesaje para confirmar la tendencia.",
                        "Validar consumo de alimento y agua.",
                        "Comparar contra animales del mismo lote.",
                        "Cruzar el caso con registros de salud o vacunación."
                    },
                RawText = text
            };
        }

        if (lastTool == "system_data_snapshot")
        {
            var priorityAnimal = GetFirstDictionaryListItem(result, "priority_animals");
            var healthAlertsCount = GetObjectValue(result, "health_alerts_count", "0");
            var animalsWithLoss = GetObjectValue(result, "animals_with_weight_loss", "0");
            var animalsWithoutWeight = GetObjectValue(result, "animals_without_recent_weight", "0");

            string message;

            if (priorityAnimal != null)
            {
                var tag = GetObjectValue(priorityAnimal, "identification_tag", "sin arete");
                var reason = GetObjectValue(priorityAnimal, "reason", "requiere revisión prioritaria");
                var score = GetObjectValue(priorityAnimal, "priority_score", "0");
                var type = ToSpanishAnimalType(GetObjectValue(priorityAnimal, "animal_type", "animal"));

                message =
                    $"El animal que debes atender primero es el arete {tag}, de tipo {type}. " +
                    $"La razón principal es que {reason}. Su puntaje de prioridad es {score}." +
                    " Recomiendo revisar consumo de alimento y agua, temperatura, condición corporal, signos de decaimiento y realizar un pesaje de control. " +
                    "Si la pérdida de peso continúa o el estado general empeora, debe registrarse un seguimiento de salud antes de cerrar el caso.";
            }
            else
            {
                message =
                    $"Con base en el último resumen, hay {healthAlertsCount} alertas de salud, {animalsWithLoss} animales con pérdida de peso y {animalsWithoutWeight} animales sin pesaje reciente. " +
                    "No encontré un animal crítico único, así que recomiendo revisar primero alertas de salud y luego actualizar pesajes pendientes.";
            }

            return new AuraToolAgentResponse
            {
                ToolName = "answer_from_context",
                Intent = "contextual_recommendation",
                Action = "show_aura_report",
                UiAction = "show_aura_report",
                AssistantMessage = message,
                AudioText = message,
                NeedsConfirmation = false,
                Confidence = "high",
                ToolResult = new Dictionary<string, object?>
                {
                    ["context"] = "Último snapshot del sistema",
                    ["focus_animal"] = priorityAnimal,
                    ["health_alerts_count"] = healthAlertsCount,
                    ["animals_with_weight_loss"] = animalsWithLoss,
                    ["animals_without_recent_weight"] = animalsWithoutWeight
                },
                RecommendedActions = new List<string>
                {
                    "Revisar consumo de alimento y agua.",
                    "Validar temperatura y signos de enfermedad.",
                    "Hacer nuevo pesaje de control.",
                    "Registrar seguimiento de salud si el estado no mejora."
                },
                RawText = text
            };
        }

        if (lastTool == "generate_health_report")
        {
            var message =
                "Según el último reporte de salud, recomiendo priorizar los casos de mayor severidad, revisar animales con fiebre, falta de apetito o heridas, y actualizar los tratamientos aplicados antes de cerrar la alerta.";

            return new AuraToolAgentResponse
            {
                ToolName = "answer_from_context",
                Intent = "contextual_recommendation",
                Action = "show_aura_report",
                UiAction = "show_aura_report",
                AssistantMessage = message,
                AudioText = message,
                NeedsConfirmation = false,
                Confidence = "high",
                ToolResult = lastReport.ToolResult,
                RecommendedActions = actions.Count > 0
                    ? actions
                    : new List<string>
                    {
                        "Priorizar casos de severidad alta.",
                        "Actualizar tratamientos aplicados.",
                        "Revisar animales con signos persistentes."
                    },
                RawText = text
            };
        }

        if (lastTool == "generate_inventory_report")
        {
            var message =
                "Según el último reporte de inventario, recomiendo validar animales con datos incompletos, revisar que cada arete sea único y actualizar los registros antes de generar reportes finales.";

            return new AuraToolAgentResponse
            {
                ToolName = "answer_from_context",
                Intent = "contextual_recommendation",
                Action = "show_aura_report",
                UiAction = "show_aura_report",
                AssistantMessage = message,
                AudioText = message,
                NeedsConfirmation = false,
                Confidence = "high",
                ToolResult = lastReport.ToolResult,
                RecommendedActions = actions.Count > 0
                    ? actions
                    : new List<string>
                    {
                        "Validar aretes únicos.",
                        "Completar datos faltantes.",
                        "Revisar animales inactivos o sin peso reciente."
                    },
                RawText = text
            };
        }

        return null;
    }

    private static void SaveLastReportIfNeeded(string sessionId, AuraToolAgentResponse response)
    {
        var tool = response.ToolName ?? "";

        var isReport =
            tool == "generate_weight_gain_report" ||
            tool == "generate_inventory_report" ||
            tool == "generate_health_report" ||
            tool == "system_data_snapshot" ||
            response.Intent == "system_status_question" ||
            response.Action == "show_weight_gain_report" ||
            response.Action == "show_inventory_report" ||
            response.Action == "show_health_report";

        if (!isReport)
            return;

        lock (MemoryLock)
        {
            LastReportBySession[sessionId] = response;
        }
    }

    private static Dictionary<string, object?>? GetFirstDictionaryListItem(Dictionary<string, object?> values, string key)
    {
        if (!values.TryGetValue(key, out var value) || value == null)
            return null;

        if (value is List<Dictionary<string, object?>> list)
            return list.FirstOrDefault();

        if (value is IEnumerable<Dictionary<string, object?>> enumerable)
            return enumerable.FirstOrDefault();

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Array)
        {
            var first = element.EnumerateArray().FirstOrDefault();

            if (first.ValueKind != JsonValueKind.Object)
                return null;

            var result = new Dictionary<string, object?>();

            foreach (var property in first.EnumerateObject())
            {
                result[property.Name] = property.Value.ValueKind switch
                {
                    JsonValueKind.String => property.Value.GetString(),
                    JsonValueKind.Number => property.Value.ToString(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    _ => property.Value.ToString()
                };
            }

            return result;
        }

        return null;
    }

    private static string ToSpanishAnimalType(string type)
    {
        return Normalize(type) switch
        {
            "cattle" => "bovino",
            "ganado" => "bovino",
            "swine" => "porcino",
            "cerdo" => "porcino",
            "poultry" => "ave",
            "aves" => "ave",
            _ => type
        };
    }

    private static string GetObjectValue(Dictionary<string, object?> values, string key, string fallback)
    {
        if (!values.TryGetValue(key, out var value) || value == null)
            return fallback;

        if (value is JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.Number => element.ToString(),
                JsonValueKind.String => element.GetString() ?? fallback,
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => element.ToString()
            };
        }

        return value.ToString() ?? fallback;
    }


    private async Task<AuraToolAgentResponse?> TryBuildSystemSnapshotAnswerAsync(string text, string? farmId)
    {
        var normalized = Normalize(text);

        var wantsSnapshot =
            ContainsAny(
                normalized,
                "como esta la finca",
                "estado de la finca",
                "resumen de la finca",
                "resumen general",
                "que debo revisar",
                "que revisar hoy",
                "que hay que revisar",
                "que animal esta mas critico",
                "animal mas critico",
                "mas critico",
                "prioridad",
                "prioridades",
                "alertas de salud",
                "hay alertas",
                "animales sin pesaje",
                "sin pesaje reciente",
                "inventario general",
                "como vamos en la finca"
            );

        if (!wantsSnapshot)
            return null;

        var snapshot = await BuildSystemDataSnapshotAsync(farmId);

        var totalAnimals = GetObjectValue(snapshot, "total_animals", "0");
        var healthAlertsCount = GetObjectValue(snapshot, "health_alerts_count", "0");
        var animalsWithoutRecentWeight = GetObjectValue(snapshot, "animals_without_recent_weight", "0");
        var animalsWithWeightLoss = GetObjectValue(snapshot, "animals_with_weight_loss", "0");
        var dataSource = GetObjectValue(snapshot, "data_source", "real");

        var healthText = healthAlertsCount == "1" ? "1 alerta de salud" : $"{healthAlertsCount} alertas de salud";
        var lossText = animalsWithWeightLoss == "1" ? "1 animal con pérdida de peso" : $"{animalsWithWeightLoss} animales con pérdida de peso";
        var withoutWeightText = animalsWithoutRecentWeight == "1" ? "1 animal sin pesaje reciente" : $"{animalsWithoutRecentWeight} animales sin pesaje reciente";

        var priorityAnimal = GetFirstDictionaryListItem(snapshot, "priority_animals");

        string message;

        if (priorityAnimal != null)
        {
            var tag = GetObjectValue(priorityAnimal, "identification_tag", "sin arete");
            var reason = GetObjectValue(priorityAnimal, "reason", "requiere revisión");
            var score = GetObjectValue(priorityAnimal, "priority_score", "0");

            message =
                $"Con base en la información disponible del sistema, la finca tiene {totalAnimals} animales registrados, {healthText}, {lossText} y {withoutWeightText}. " +
                $"La prioridad actual es revisar el animal con arete {tag}, porque {reason}. Puntaje de prioridad: {score}.";
        }
        else
        {
            message =
                $"Con base en la información disponible del sistema, la finca tiene {totalAnimals} animales registrados, {healthText}, {lossText} y {withoutWeightText}. " +
                "No encontré un animal crítico específico, pero recomiendo mantener actualizados los pesajes y revisar cualquier registro de salud reciente.";
        }

        if (dataSource == "demo")
        {
            message += " Nota: no encontré datos reales suficientes, así que usé datos de demostración para mantener la experiencia de AURA.";
        }

        return new AuraToolAgentResponse
        {
            Mode = "aura_tool_agent",
            ToolName = "system_data_snapshot",
            Intent = "system_status_question",
            Action = "show_aura_report",
            UiAction = "show_aura_report",
            AssistantMessage = message,
            AudioText = message,
            NeedsConfirmation = false,
            Confidence = dataSource == "real" ? "high" : "medium",
            ToolResult = snapshot,
            RecommendedActions = new List<string>
            {
                "Revisar primero los animales con mayor prioridad.",
                "Actualizar pesajes faltantes o antiguos.",
                "Cruzar pérdida de peso con registros de salud.",
                "Validar consumo de alimento y agua en animales críticos."
            },
            RawText = text
        };
    }

    private async Task<Dictionary<string, object?>> BuildSystemDataSnapshotAsync(string? farmId)
    {
        try
        {
            var animalsQuery = _context.Animals
                .IgnoreQueryFilters()
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(farmId) && Guid.TryParse(farmId, out var parsedFarmId))
            {
                animalsQuery = animalsQuery.Where(a => a.FarmId == parsedFarmId);
            }

            var animals = await animalsQuery.ToListAsync();

            if (animals.Count == 0)
            {
                return DemoSystemDataSnapshot();
            }

            var animalIds = animals.Select(a => a.Id).ToHashSet();

            var weights = await _context.WeightLogs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(w => animalIds.Contains(w.AnimalId))
                .OrderBy(w => w.LogDate)
                .ToListAsync();

            var healthRecords = await _context.HealthRecords
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(h => animalIds.Contains(h.AnimalId))
                .OrderByDescending(h => h.RecordedAt)
                .ToListAsync();

            var recentWeightCutoff = DateTime.UtcNow.AddDays(-45);
            var recentHealthCutoff = DateTime.UtcNow.AddDays(-30);

            var animalsByType = animals
                .GroupBy(a => a.Type.ToString())
                .ToDictionary(g => g.Key, g => (object?)g.Count());

            var weightLossDetails = new List<Dictionary<string, object?>>();
            var withoutRecentWeightDetails = new List<Dictionary<string, object?>>();
            var healthAlertDetails = new List<Dictionary<string, object?>>();
            var priorityAnimals = new List<Dictionary<string, object?>>();

            foreach (var animal in animals)
            {
                var animalWeights = weights
                    .Where(w => w.AnimalId == animal.Id)
                    .OrderBy(w => w.LogDate)
                    .ToList();

                var animalHealth = healthRecords
                    .Where(h => h.AnimalId == animal.Id)
                    .ToList();

                var recentHealth = animalHealth
                    .Where(h => h.RecordedAt >= recentHealthCutoff)
                    .ToList();

                var priorityScore = 0;
                var reasons = new List<string>();

                if (animalWeights.Count >= 2)
                {
                    var previous = animalWeights[^2];
                    var last = animalWeights[^1];
                    var diff = last.WeightKg - previous.WeightKg;

                    if (diff < 0)
                    {
                        priorityScore += 3;
                        reasons.Add($"presenta pérdida de peso de {diff} kg");

                        weightLossDetails.Add(new Dictionary<string, object?>
                        {
                            ["identification_tag"] = animal.IdentificationTag,
                            ["previous_weight_kg"] = previous.WeightKg,
                            ["last_weight_kg"] = last.WeightKg,
                            ["difference_kg"] = diff,
                            ["previous_weight_date"] = previous.LogDate.ToString("yyyy-MM-dd"),
                            ["last_weight_date"] = last.LogDate.ToString("yyyy-MM-dd")
                        });
                    }

                    if (last.LogDate < recentWeightCutoff)
                    {
                        priorityScore += 1;
                        reasons.Add("no tiene pesaje reciente");

                        withoutRecentWeightDetails.Add(new Dictionary<string, object?>
                        {
                            ["identification_tag"] = animal.IdentificationTag,
                            ["reason"] = "Último pesaje antiguo",
                            ["last_weight_date"] = last.LogDate.ToString("yyyy-MM-dd")
                        });
                    }
                }
                else
                {
                    priorityScore += 1;
                    reasons.Add("no tiene suficientes registros de peso");

                    withoutRecentWeightDetails.Add(new Dictionary<string, object?>
                    {
                        ["identification_tag"] = animal.IdentificationTag,
                        ["reason"] = "No tiene suficientes registros de peso",
                        ["weight_logs_count"] = animalWeights.Count
                    });
                }

                if (recentHealth.Count > 0)
                {
                    priorityScore += 2;
                    reasons.Add("tiene registros de salud recientes");

                    foreach (var health in recentHealth.Take(3))
                    {
                        healthAlertDetails.Add(new Dictionary<string, object?>
                        {
                            ["identification_tag"] = animal.IdentificationTag,
                            ["description"] = health.SymptomsDescription,
                            ["diagnosis"] = health.Diagnosis,
                            ["treatment"] = health.TreatmentAdministered,
                            ["recorded_at"] = health.RecordedAt.ToString("yyyy-MM-dd")
                        });
                    }
                }

                if (priorityScore > 0)
                {
                    priorityAnimals.Add(new Dictionary<string, object?>
                    {
                        ["identification_tag"] = animal.IdentificationTag,
                        ["animal_type"] = animal.Type.ToString(),
                        ["status"] = animal.Status,
                        ["priority_score"] = priorityScore,
                        ["reason"] = string.Join("; ", reasons),
                        ["health_alerts_count"] = recentHealth.Count,
                        ["weight_logs_count"] = animalWeights.Count
                    });
                }
            }

            priorityAnimals = priorityAnimals
                .OrderByDescending(a => Convert.ToInt32(a["priority_score"]))
                .ThenBy(a => a["identification_tag"]?.ToString())
                .Take(5)
                .ToList();

            return new Dictionary<string, object?>
            {
                ["data_source"] = "real",
                ["total_animals"] = animals.Count,
                ["animals_by_type"] = animalsByType,
                ["health_alerts_count"] = healthAlertDetails.Count,
                ["animals_with_weight_loss"] = weightLossDetails.Count,
                ["animals_without_recent_weight"] = withoutRecentWeightDetails.Count,
                ["weight_loss_details"] = weightLossDetails.Take(5).ToList(),
                ["animals_without_recent_weight_details"] = withoutRecentWeightDetails.Take(5).ToList(),
                ["health_alerts"] = healthAlertDetails.Take(5).ToList(),
                ["priority_animals"] = priorityAnimals,
                ["activities_available"] = false,
                ["activities_note"] = "No existe todavía un DbSet real de actividades o tareas en el backend."
            };
        }
        catch (Exception ex)
        {
            var demo = DemoSystemDataSnapshot();
            demo["debug_error"] = ex.GetType().Name;
            demo["debug_message"] = ex.Message;
            return demo;
        }
    }

    private static Dictionary<string, object?> DemoSystemDataSnapshot()
    {
        return new Dictionary<string, object?>
        {
            ["data_source"] = "demo",
            ["total_animals"] = 6,
            ["animals_by_type"] = new Dictionary<string, object?>
            {
                ["Cattle"] = 4,
                ["Swine"] = 1,
                ["Poultry"] = 1
            },
            ["health_alerts_count"] = 1,
            ["animals_with_weight_loss"] = 1,
            ["animals_without_recent_weight"] = 2,
            ["weight_loss_details"] = new List<Dictionary<string, object?>>
            {
                new()
                {
                    ["identification_tag"] = "302",
                    ["previous_weight_kg"] = 200,
                    ["last_weight_kg"] = 180,
                    ["difference_kg"] = -20,
                    ["previous_weight_date"] = "2026-06-01",
                    ["last_weight_date"] = "2026-06-25"
                }
            },
            ["animals_without_recent_weight_details"] = new List<Dictionary<string, object?>>
            {
                new()
                {
                    ["identification_tag"] = "045",
                    ["reason"] = "No tiene suficientes registros de peso",
                    ["weight_logs_count"] = 1
                },
                new()
                {
                    ["identification_tag"] = "118",
                    ["reason"] = "No tiene pesaje reciente registrado",
                    ["weight_logs_count"] = 0
                }
            },
            ["health_alerts"] = new List<Dictionary<string, object?>>
            {
                new()
                {
                    ["identification_tag"] = "302",
                    ["description"] = "Revisión pendiente por posible decaimiento.",
                    ["recorded_at"] = "2026-06-24"
                }
            },
            ["priority_animals"] = new List<Dictionary<string, object?>>
            {
                new()
                {
                    ["identification_tag"] = "302",
                    ["animal_type"] = "Cattle",
                    ["status"] = "healthy",
                    ["priority_score"] = 5,
                    ["reason"] = "presenta pérdida de peso de -20 kg; tiene registros de salud recientes",
                    ["health_alerts_count"] = 1,
                    ["weight_logs_count"] = 2
                }
            },
            ["activities_available"] = false,
            ["activities_note"] = "No existe todavía un DbSet real de actividades o tareas en el backend."
        };
    }

    private string LoadContext()
    {
        var root = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "..", "..", ".."));
        var contractPath = Path.Combine(root, "fincapp-ai-data", "edge-intelligence", "aura_tools_contract.md");
        var agentPath = Path.Combine(root, "fincapp-ai-data", "edge-intelligence", "aura_agent_context.md");

        var parts = new List<string>();

        if (System.IO.File.Exists(contractPath))
        {
            parts.Add(System.IO.File.ReadAllText(contractPath));
        }

        if (System.IO.File.Exists(agentPath))
        {
            parts.Add(System.IO.File.ReadAllText(agentPath));
        }

        return parts.Count == 0
            ? "You are AURA, a professional agro-livestock operations assistant. Return JSON only."
            : string.Join("\n\n", parts);
    }

    private static string NormalizeToolName(string? toolName, string? intent, string? action)
    {
        var t = Normalize(toolName ?? "");
        var i = Normalize(intent ?? "");
        var a = Normalize(action ?? "");

        if (ContainsAny(t, "register_vaccination", "register_deworming", "register_treatment", "register_medicine", "register_health") ||
            ContainsAny(i, "vaccination", "deworming", "treatment", "medicine", "health") ||
            ContainsAny(a, "health"))
        {
            return "register_health_record_draft";
        }

        if (ContainsAny(t, "register_animal", "animal_draft") || ContainsAny(i, "register_animal"))
            return "register_animal_draft";

        if (ContainsAny(t, "register_weight", "weight_draft") || ContainsAny(i, "register_weight") || ContainsAny(a, "weight"))
            return "register_weight_draft";

        if (ContainsAny(t, "activity", "task", "maintenance", "feeding", "cleaning") ||
            ContainsAny(i, "activity", "task", "maintenance", "feeding", "cleaning"))
            return "register_activity_draft";

        if (ContainsAny(t, "export_inventory") || ContainsAny(i, "export_inventory"))
            return "export_inventory_pdf";

        if (ContainsAny(t, "weight_gain_report") || ContainsAny(i, "weight_gain", "generate_report") || ContainsAny(a, "weight_gain_report"))
            return "generate_weight_gain_report";

        if (ContainsAny(t, "inventory_report") || ContainsAny(i, "inventory_report"))
            return "generate_inventory_report";

        if (ContainsAny(t, "health_report") || ContainsAny(i, "health_report"))
            return "generate_health_report";

        if (ContainsAny(t, "search_animal") || ContainsAny(i, "search_animal"))
            return "search_animal_by_tag";

        if (ContainsAny(t, "open_module") || ContainsAny(a, "open_dashboard", "open_inventory", "open_reports", "open_health", "open_weights"))
            return "open_module";

        return string.IsNullOrWhiteSpace(toolName) ? "unknown" : toolName!;
    }

    private static string NormalizeAction(string toolName, string? current)
    {
        return toolName switch
        {
            "register_animal_draft" => "open_animal_registration",
            "register_weight_draft" => "open_weight_registration",
            "register_health_record_draft" => "open_health_registration",
            "register_activity_draft" => "open_activity_registration",
            "export_inventory_pdf" => "export_inventory_pdf",
            "generate_weight_gain_report" => "show_weight_gain_report",
            "generate_inventory_report" => "show_inventory_report",
            "generate_health_report" => "show_health_report",
            "search_animal_by_tag" => "search_animal",
            _ => string.IsNullOrWhiteSpace(current) ? "none" : current!
        };
    }

    private static AuraToolAgentResponse OpenModule(string module, string rawText)
    {
        return new AuraToolAgentResponse
        {
            ToolName = "open_module",
            Intent = "open_module",
            Action = ModuleToAction(module),
            UiAction = ModuleToAction(module),
            ToolArgs = new Dictionary<string, object?>
            {
                ["module"] = module
            },
            AssistantMessage = $"Abriré el módulo de {ModuleLabel(module)}.",
            AudioText = $"Abriré el módulo de {ModuleLabel(module)}.",
            Confidence = "high",
            RawText = rawText
        };
    }

    private static string ModuleToAction(string module)
    {
        return Normalize(module) switch
        {
            "dashboard" => "open_dashboard",
            "inventory" => "open_inventory",
            "weights" => "open_weight_registration",
            "health" => "open_health_registration",
            "activities" => "open_activity_registration",
            "reports" => "open_reports",
            "settings" => "open_settings",
            _ => "open_dashboard"
        };
    }

    private static string ModuleLabel(string module)
    {
        return Normalize(module) switch
        {
            "dashboard" => "dashboard",
            "inventory" => "inventario",
            "weights" => "control de peso",
            "health" => "salud",
            "activities" => "actividades",
            "reports" => "reportes",
            "settings" => "ajustes",
            _ => module
        };
    }

    private static string ExtractGeminiText(string rawResponse)
    {
        using var doc = JsonDocument.Parse(rawResponse);
        var root = doc.RootElement;

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            return "{}";

        var content = candidates[0].GetProperty("content");
        var parts = content.GetProperty("parts");

        if (parts.GetArrayLength() == 0)
            return "{}";

        return parts[0].GetProperty("text").GetString() ?? "{}";
    }

    private static string CleanJson(string value)
    {
        var text = value.Trim();

        if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            text = text[7..].Trim();

        if (text.StartsWith("```"))
            text = text[3..].Trim();

        if (text.EndsWith("```"))
            text = text[..^3].Trim();

        return text;
    }

    private static bool ContainsAny(string text, params string[] values)
    {
        return values.Any(v => text.Contains(Normalize(v)));
    }

    private static string? DetectTag(string text)
    {
        var match = Regex.Match(
            text,
            @"(?:arete|numero|codigo|tag|id|identificacion|placa|chapeta|marquilla)\s+([a-z0-9\-]+)",
            RegexOptions.IgnoreCase
        );

        if (match.Success) return match.Groups[1].Value.ToUpperInvariant();

        var compact = Regex.Match(text, @"\b([0-9]{2,6})\b");
        return compact.Success ? compact.Groups[1].Value.ToUpperInvariant() : null;
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
            @"raza\s+([a-z0-9áéíóúñ \-]+?)(?:\s+fecha|\s+nacimiento|\s+nacio|\s+peso|\s+pesando|\s+y\s+su\s+peso|$)",
            RegexOptions.IgnoreCase
        );

        return match.Success
            ? CultureInfo.CurrentCulture.TextInfo.ToTitleCase(match.Groups[1].Value.Trim())
            : null;
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

        return month == 0 ? null : new DateTime(year, month, day).ToString("yyyy-MM-dd");
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

        if (ContainsAny(text, "vaca", "toro", "ternero", "novillo", "res", "ganado", "bovino") ||
            ContainsAny(b, "brahman", "cebu", "holstein", "gyr", "jersey", "simmental"))
            return "cattle";

        if (ContainsAny(text, "cerdo", "marrano", "puerco", "porcino"))
            return "swine";

        if (ContainsAny(text, "pollo", "gallina", "ave", "aves"))
            return "poultry";

        return null;
    }

    private static string InferSeverity(string text)
    {
        if (ContainsAny(text, "fiebre", "sangre", "sangrado", "no come", "herida profunda"))
            return "high";

        if (ContainsAny(text, "diarrea", "vomito", "tos", "cojo", "cojera", "inflamacion", "decaido", "debil"))
            return "medium";

        return "low";
    }

    private static string? GetStringArg(AuraToolAgentResponse response, string key)
    {
        if (response.ToolArgs == null || !response.ToolArgs.TryGetValue(key, out var value) || value == null)
            return null;

        if (value is JsonElement element)
        {
            return element.ValueKind == JsonValueKind.String ? element.GetString() : element.ToString();
        }

        return value.ToString();
    }

    private static decimal? GetDecimalArg(AuraToolAgentResponse response, string key)
    {
        if (response.ToolArgs == null || !response.ToolArgs.TryGetValue(key, out var value) || value == null)
            return null;

        if (value is JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Number && element.TryGetDecimal(out var dec))
                return dec;

            if (element.ValueKind == JsonValueKind.String &&
                decimal.TryParse(element.GetString()?.Replace(",", "."), NumberStyles.Number, CultureInfo.InvariantCulture, out var strDec))
                return strDec;
        }

        if (decimal.TryParse(value.ToString()?.Replace(",", "."), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        return null;
    }

    private static string Normalize(string value)
    {
        return (value ?? "")
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
            if (!Memory.ContainsKey(sessionId))
                Memory[sessionId] = new List<string>();

            Memory[sessionId].Add(message);

            if (Memory[sessionId].Count > 12)
                Memory[sessionId] = Memory[sessionId].TakeLast(12).ToList();
        }
    }

    private static List<string> GetHistory(string sessionId)
    {
        lock (MemoryLock)
        {
            return Memory.TryGetValue(sessionId, out var history)
                ? history.ToList()
                : new List<string>();
        }
    }
}

public class AuraToolAgentRequest
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("session_id")]
    public string? SessionId { get; set; }

    [JsonPropertyName("farm_id")]
    public string? FarmId { get; set; }
}

public class AuraToolAgentResponse
{
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "aura_tool_agent";

    [JsonPropertyName("tool_name")]
    public string ToolName { get; set; } = "unknown";

    [JsonPropertyName("tool_args")]
    public Dictionary<string, object?> ToolArgs { get; set; } = new();

    [JsonPropertyName("ui_action")]
    public string UiAction { get; set; } = "none";

    [JsonPropertyName("action")]
    public string Action { get; set; } = "none";

    [JsonPropertyName("intent")]
    public string Intent { get; set; } = "unknown";

    [JsonPropertyName("assistant_message")]
    public string AssistantMessage { get; set; } = string.Empty;

    [JsonPropertyName("audio_text")]
    public string AudioText { get; set; } = string.Empty;

    [JsonPropertyName("aura_response")]
    public string AuraResponse => string.IsNullOrWhiteSpace(AudioText) ? AssistantMessage : AudioText;

    [JsonPropertyName("needs_confirmation")]
    public bool NeedsConfirmation { get; set; } = true;

    [JsonPropertyName("missing_fields")]
    public List<string> MissingFields { get; set; } = new();

    [JsonPropertyName("tool_result")]
    public Dictionary<string, object?> ToolResult { get; set; } = new();

    [JsonPropertyName("recommended_actions")]
    public List<string> RecommendedActions { get; set; } = new();

    [JsonPropertyName("confidence")]
    public string Confidence { get; set; } = "medium";

    [JsonPropertyName("raw_text")]
    public string RawText { get; set; } = string.Empty;

    public static AuraToolAgentResponse Say(string message, string rawText = "")
    {
        return new AuraToolAgentResponse
        {
            ToolName = "none",
            Action = "none",
            UiAction = "none",
            Intent = "assistant_response",
            AssistantMessage = message,
            AudioText = message,
            NeedsConfirmation = false,
            Confidence = "medium",
            RawText = rawText
        };
    }
}

public class ReportResult
{
    public string AssistantMessage { get; set; } = string.Empty;
    public Dictionary<string, object?> ToolResult { get; set; } = new();
    public List<string> RecommendedActions { get; set; } = new();
}
