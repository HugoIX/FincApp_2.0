using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/aura")]
public class AuraSpeechController : ControllerBase
{
    private static readonly HttpClient Http = new();

    private readonly IConfiguration _configuration;

    public AuraSpeechController(IConfiguration configuration)
    {
        _configuration = configuration;
    }


    [HttpGet("speech/voices")]
    public async Task<IActionResult> ListVoices()
    {
        var apiKey = _configuration["ElevenLabs:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return StatusCode(500, new
            {
                error = "ElevenLabs API key is not configured."
            });
        }

        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Get,
            "https://api.elevenlabs.io/v1/voices"
        );

        httpRequest.Headers.TryAddWithoutValidation("xi-api-key", apiKey);

        using var response = await Http.SendAsync(httpRequest);
        var responseText = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new
            {
                error = "Could not list ElevenLabs voices.",
                details = responseText
            });
        }

        return Content(responseText, "application/json");
    }


    [HttpPost("speech")]
    public async Task<IActionResult> GenerateSpeech([FromBody] AuraSpeechRequest request)
    {
        var text = request.Text?.Trim();

        if (string.IsNullOrWhiteSpace(text))
        {
            return BadRequest(new
            {
                error = "Text is required."
            });
        }

        var apiKey = _configuration["ElevenLabs:ApiKey"];
        var voiceId = _configuration["ElevenLabs:VoiceId"];
        var modelId = _configuration["ElevenLabs:ModelId"] ?? "eleven_multilingual_v2";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return StatusCode(500, new
            {
                error = "ElevenLabs API key is not configured."
            });
        }

        if (string.IsNullOrWhiteSpace(voiceId))
        {
            return StatusCode(500, new
            {
                error = "ElevenLabs Voice ID is not configured."
            });
        }

        var payload = new
        {
            text,
            model_id = modelId,
            voice_settings = new
            {
                stability = request.Stability ?? 0.62,
                similarity_boost = request.SimilarityBoost ?? 0.80,
                style = request.Style ?? 0.16,
                use_speaker_boost = true
            }
        };

        var url = $"https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128";

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.TryAddWithoutValidation("xi-api-key", apiKey);
        httpRequest.Headers.TryAddWithoutValidation("Accept", "audio/mpeg");

        httpRequest.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json"
        );

        using var response = await Http.SendAsync(httpRequest);
        var audioBytes = await response.Content.ReadAsByteArrayAsync();

        if (!response.IsSuccessStatusCode)
        {
            var errorText = Encoding.UTF8.GetString(audioBytes);

            return StatusCode((int)response.StatusCode, new
            {
                error = "ElevenLabs request failed.",
                details = errorText
            });
        }

        return File(audioBytes, "audio/mpeg");
    }
}

public class AuraSpeechRequest
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("stability")]
    public double? Stability { get; set; }

    [JsonPropertyName("similarity_boost")]
    public double? SimilarityBoost { get; set; }

    [JsonPropertyName("style")]
    public double? Style { get; set; }
}
