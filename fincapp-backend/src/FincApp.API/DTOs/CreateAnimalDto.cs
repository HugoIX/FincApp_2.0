using System;
using FincApp.Core;

namespace FincApp.API.DTOs;

public class CreateAnimalDto
{
    public ProductionType Type { get; set; }
    public string IdentificationTag { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string Status { get; set; } = "healthy";
}
