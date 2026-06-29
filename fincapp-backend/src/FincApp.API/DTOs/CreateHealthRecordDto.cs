namespace FincApp.API.DTOs;

public class CreateHealthRecordDto
{
    public string SymptomsDescription { get; set; } = string.Empty;
    public string? Diagnosis { get; set; }
    public string? TreatmentAdministered { get; set; }
}
