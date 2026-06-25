package com.irwi.fincapp.aura;

import java.text.Normalizer;
import java.util.Locale;

/**
 * HU-01-AURA | Local demo brain for the AURA assistant.
 *
 * This class intentionally works offline and does not call any external AI API.
 * It gives the team a stable demo experience while the cloud/edge AI modules evolve.
 */
public class AuraScriptEngine {

    private AuraScriptEngine() {
        // Utility class.
    }

    public static String buildIntroMessage(String userName, String role, int activeFarms, int pendingSyncItems) {
        String safeUserName = isBlank(userName) ? "equipo FincApp" : userName.trim();
        String safeRole = isBlank(role) ? "field_worker" : role.trim().toLowerCase(Locale.ROOT);

        if (safeRole.contains("admin")) {
            return "Buenos días, " + safeUserName + ".\n\n" +
                    "Mi nombre es AURA. Soy el Agente Inteligente de Operaciones Agropecuarias de FincApp.\n\n" +
                    "Fui diseñada para ayudarte a administrar fincas, trabajadores, animales, alertas de salud, registros de peso y reportes productivos.\n\n" +
                    "Actualmente detecto " + activeFarms + " fincas activas y " + pendingSyncItems + " elementos pendientes de sincronización local.\n\n" +
                    "Puedo trabajar contigo incluso sin conexión a internet, guardar información en el dispositivo y sincronizarla automáticamente cuando la señal regrese.\n\n" +
                    "Estoy lista para trabajar contigo. ¿Cómo puedo ayudarte hoy?";
        }

        return "Buenos días, " + safeUserName + ".\n\n" +
                "Mi nombre es AURA. Soy el Agente Inteligente de Operaciones Agropecuarias de FincApp.\n\n" +
                "Estoy diseñada para ayudarte en campo a registrar animales, pesos, vacunas, síntomas, tareas y evidencias, incluso cuando no tengas conexión a internet.\n\n" +
                "Actualmente detecto " + activeFarms + " fincas disponibles y " + pendingSyncItems + " elementos pendientes de sincronización local.\n\n" +
                "Cuando recuperes señal, FincApp podrá sincronizar la información con la plataforma central.\n\n" +
                "Estoy lista para trabajar contigo. ¿Qué deseas registrar hoy?";
    }

    public static String answerQuestion(String rawQuestion) {
        String question = normalize(rawQuestion);

        if (question.contains("quien eres") || question.contains("que eres") || question.contains("presentate")) {
            return "Soy AURA, el Agente Inteligente de Operaciones Agropecuarias de FincApp.\n\n" +
                    "Mi propósito es acompañar al productor rural y a sus trabajadores en la gestión diaria de sus fincas.\n\n" +
                    "Puedo ayudarte a registrar animales, pesos, vacunas, síntomas, tareas de campo, evidencias fotográficas, alertas sanitarias y reportes productivos.\n\n" +
                    "También estoy preparada para trabajar en zonas rurales sin internet, guardar la información localmente y sincronizarla cuando vuelva la conexión.";
        }

        if (question.contains("sin internet") || question.contains("offline") || question.contains("conexion") || question.contains("senal")) {
            return "FincApp está diseñada con enfoque offline first.\n\n" +
                    "Eso significa que puedes registrar información aunque no tengas conexión. Los datos se guardan localmente en SQLite con estado pending y luego se sincronizan cuando la red vuelve a estar disponible.";
        }

        if (question.contains("registrar") || question.contains("animal") || question.contains("peso") || question.contains("arete")) {
            return "Puedo ayudarte a registrar información de campo.\n\n" +
                    "Por ejemplo, puedes decir: registra una vaca con arete 302 y peso de 520 kilos.\n\n" +
                    "En la siguiente historia de usuario convertiré esa frase en datos estructurados para guardarlos offline.";
        }

        if (question.contains("vacuna") || question.contains("salud") || question.contains("sintoma") || question.contains("enfermo")) {
            return "Puedo apoyar el seguimiento sanitario registrando síntomas, vacunas, tratamientos y observaciones de salud.\n\n" +
                    "Cuando esos datos se sincronicen, la capa de inteligencia en la nube podrá generar alertas o recomendaciones para el administrador.";
        }

        if (question.contains("dashboard") || question.contains("reporte") || question.contains("indicador")) {
            return "Puedo ayudarte a interpretar indicadores de la finca: inventario, peso promedio, animales con alertas de salud y registros pendientes de sincronización.\n\n" +
                    "El objetivo es que el administrador tome decisiones rápidas sin revisar datos manualmente.";
        }

        return "Puedo ayudarte con gestión ganadera, registros de campo, alertas sanitarias, control de peso, tareas de trabajadores, reportes y sincronización offline.\n\n" +
                "Para esta demostración puedes preguntarme: ¿Quién eres? o ¿Puedes trabajar sin internet?";
    }

    private static String normalize(String value) {
        if (value == null) return "";
        String lower = value.toLowerCase(Locale.ROOT).trim();
        String decomposed = Normalizer.normalize(lower, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}", "");
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
