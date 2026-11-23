#!/usr/bin/env python3
"""
ReciBot Shared Dataset, 512-Token Domain Vocabulary + FNV-1a OOV Hashing,
32-Intent Taxonomy, 12 Verification Tools, Pretraining Corpus, DPO Pairs,
and 40-Doc Hybrid RAG Knowledge Base for ReciminsaApp.
"""

from __future__ import annotations

from collections import Counter
import json
import math
import random
import re
from pathlib import Path
from typing import Dict, List, Tuple

VOCAB_SIZE = 20000
NUM_DOMAIN_WORDS = 11804  # IDs 4..11807
OOV_BUCKET_START = 11808  # IDs 11808..19999 (8192 FNV-1a buckets)
OOV_NUM_BUCKETS = 8192   # 2^13 (bitmask & 8191, 64x lower collision rate)
MAX_SEQ_LEN = 32

MODEL_IDENTITIES = {
    "neo": {
        "name": "ReciBot Neo",
        "codename": "Argón-Auditor",
        "role": "Auditoría Profunda y Razonamiento Corporativo",
        "greeting": "Soy ReciBot Neo (Argón-Auditor), tu asistente de razonamiento profundo, auditoría legal y control operativo en ReciminsaApp.",
        "style": "Analítico, verificador en multi-paso y exhaustivo; valido consistencia financiera, comprobantes NCF/DGII y cumplimiento legal antes de concluir.",
        "traits": [
            "Razonamiento multi-paso con Transformer GPT + LoRA + DPO",
            "Verificación cruzada de finanzas, inventario y cumplimiento DGII/TSS",
            "Análisis jurídico empresarial y redacción estructurada de cláusulas",
        ],
    },
    "flash": {
        "name": "ReciBot Flash",
        "codename": "Pulso-Ágil",
        "role": "Ejecución Ultrarrápida y Asistencia Directa",
        "greeting": "Soy ReciBot Flash (Pulso-Ágil), tu asistente de respuesta instantánea y ejecución ágil en ReciminsaApp.",
        "style": "Directo, veloz y concreto; priorizo darte métricas clave, atajos operativos y respuestas breves sin rodeos.",
        "traits": [
            "Inferencia ligera destilada desde ReciBot Neo en milisegundos",
            "Consultas rápidas de balance, facturas, rutas, envases y recordatorios legales",
            "Respuestas compactas optimizadas para operación continua en campo y oficina",
        ],
    },
}
PAD_ID = 0
UNK_ID = 1
CLS_ID = 2
SEP_ID = 3

D_IN = 128
NUM_INTENTS = 42
NUM_TOOLS = 13
NUM_DEPTHS = 3

TOOLS: List[str] = [
    "check_ncf_dgii",
    "check_branches",
    "check_finances",
    "check_invoices_bitacoras",
    "check_clients",
    "check_materials_prices",
    "check_quotes_docs",
    "check_routes",
    "check_collaborators",
    "check_system_sync",
    "check_control_center",
    "run_calculator_or_nav",
    "check_legal_compliance",
]
TOOL_INDEX: Dict[str, int] = {name: i for i, name in enumerate(TOOLS)}
DEPTH_LABELS = ["direct", "verified_single", "deep_multi_check"]

INTENT_DEFS: List[Dict] = [
    {
        "id": 0,
        "name": "greeting",
        "title": "Saludo inicial",
        "depth": 0,
        "tools": [],
        "patterns": [
            "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches",
            "saludos", "que tal", "hola recibot", "hey bot", "hola asistente",
            "como estas", "buen dia", "que onda", "hola amigo", "buenas como vas",
        ],
    },
    {
        "id": 1,
        "name": "thanks_farewell",
        "title": "Agradecimiento y despedida",
        "depth": 0,
        "tools": [],
        "patterns": [
            "gracias", "muchas gracias", "excelente gracias", "perfecto entendido",
            "genial todo claro", "ok gracias", "listo gracias", "nos vemos",
            "hasta luego", "adios", "chao", "te lo agradezco", "de maravilla",
            "muy bien gracias", "super bien",
        ],
    },
    {
        "id": 2,
        "name": "identity_capabilities",
        "title": "Identidad y Capacidades de ReciBot Neo y Flash",
        "depth": 0,
        "tools": [],
        "patterns": [
            "quien eres", "que puedes hacer", "que eres recibot", "ayuda general",
            "diferencia entre neo y flash", "como funciona recibot neo",
            "para que sirve recibot flash", "cuales son tus funciones",
            "explicame que haces en la app", "que modulos manejas",
            "eres una inteligencia artificial", "que modelo es mejor",
            "como uso este chat", "comandos disponibles",
            "presentate", "cual es tu identidad", "como te llamas",
            "cuantos parametros tienes", "cuantos parametros tiene neo",
            "cuantos parametros tiene flash", "cuantos tokens tienes",
            "cual es tu vocabulario", "que es argon auditor", "que es pulso agil",
            "hablame de ti", "tu arquitectura y parametros",
            "quien te creo", "como te entrenaron", "en que lenguajes estas hecho",
            "necesitas internet para funcionar", "funcionas offline sin internet",
            "tienes sentimientos o conciencia", "eres humano o inteligencia artificial",
            "cuales son tus limites", "cual es tu precision", "para que app fuiste creado",
            "de que empresa eres", "cual es tu version", "que sabes sobre ti",
            "tienes memoria", "cuantos turnos recuerdas",
            "diferencia entre argon auditor y pulso agil",
        ],
    },
    {
        "id": 3,
        "name": "audit_full_app",
        "title": "Auditoria integral de toda la app",
        "depth": 2,
        "tools": [
            "check_ncf_dgii", "check_branches", "check_finances",
            "check_invoices_bitacoras", "check_clients", "check_materials_prices",
            "check_system_sync",
        ],
        "patterns": [
            "auditoria total de la app", "auditar toda la aplicacion",
            "revisa toda mi empresa y dime que falta", "diagnostico completo del negocio",
            "chequea todo legal dgii finanzas y materiales", "auditoria general reciminsa",
            "verifica fallos en toda la app", "estado completo de operaciones y fiscal",
            "hazme un chequeo profundo de todo el sistema", "revisar errores legales y de datos",
            "analiza todo mi negocio ahora", "supervision completa modo neo",
            "dame un reporte maestro con comprobaciones", "revisar cumplimiento completo",
        ],
    },
    {
        "id": 4,
        "name": "audit_dgii_ncf",
        "title": "Auditoria y secuencias NCF DGII",
        "depth": 2,
        "tools": ["check_ncf_dgii", "check_invoices_bitacoras"],
        "patterns": [
            "estado ncf dgii", "cuantos ncf me quedan disponibles",
            "revisar secuencias de comprobantes fiscales", "secuencia b01 agotada o vencida",
            "tengo ncf disponibles para b01 y b02", "verificar vencimiento de comprobantes dgii",
            "puedo facturar sin secuencia ncf", "es ilegal facturar b01 sin secuencia ncf",
            "configurar rango de comprobantes b01 b02 b14 b15 e31", "comprobar ncf restantes",
            "parametrizaciones ncf inventario de comprobantes", "se acabaron los comprobantes fiscales",
            "chequear alerta de ncf por vencer", "validar secuencias dgii activas",
        ],
    },
    {
        "id": 5,
        "name": "dgii_reports_606_607_608",
        "title": "Reportes fiscales DGII 606 607 608 y IT-1",
        "depth": 2,
        "tools": ["check_ncf_dgii", "check_invoices_bitacoras", "check_finances"],
        "patterns": [
            "reporte 607 ventas dgii", "generar formato 606 compras",
            "formato 608 comprobantes anulados", "declaracion it1 itbis mensual",
            "exportar txt para oficina virtual dgii", "donde veo el 606 y 607",
            "cuando va un ncf al formato 608", "facturas anuladas para reporte 608",
            "reporte 609 pagos al exterior", "resumen fiscal mensual dgii",
            "cuanto debo reportar en el 607", "auditar comprobantes para 607 y 608",
            "manejo dgii impuestos", "descargar archivos txt 606 607 608",
        ],
    },
    {
        "id": 6,
        "name": "dgii_rnc_lookup",
        "title": "Consulta y validacion de RNC o Cedula DGII",
        "depth": 1,
        "tools": ["check_clients", "check_ncf_dgii"],
        "patterns": [
            "validar rnc en dgii", "buscar razon social por rnc",
            "autocompletar empresa con rnc o cedula", "verificar si un rnc esta activo en dgii",
            "el cliente necesita rnc obligatorio para b01", "cuantos digitos tiene el rnc y la cedula",
            "consultar contribuyente dgii por nombre", "rnc de 9 digitos y cedula de 11 digitos",
            "error de rnc obligatorio en credito fiscal b01 b14 b15",
            "como busco una empresa en la dgii al facturar", "lupa dgii en clientes y facturas",
        ],
    },
    {
        "id": 7,
        "name": "invoice_create_help",
        "title": "Como crear factura fiscal o sin comprobante",
        "depth": 1,
        "tools": ["check_ncf_dgii", "check_branches"],
        "patterns": [
            "como creo una factura de venta", "emitir factura sin comprobante fiscal",
            "hacer factura con credito fiscal b01", "facturar consumidor final b02",
            "factura comercial interna sin ncf", "como funciona la pestana de facturas",
            "aplicar isc itbis y retenciones isr en factura", "como selecciono metodo de pago al facturar",
            "pasos para crear factura regimen especial b14 o gubernamental b15",
            "donde pongo el ncf al facturar", "como convierto una factura en conduce o despacho",
            "emitir factura electronica e31",
        ],
    },
    {
        "id": 8,
        "name": "invoice_summary_live",
        "title": "Resumen en vivo de facturas emitidas",
        "depth": 1,
        "tools": ["check_invoices_bitacoras", "check_branches", "check_finances"],
        "patterns": [
            "cuantas facturas he emitido", "muestrame las ultimas facturas",
            "resumen de facturas de venta", "total facturado hasta hoy",
            "cuantas facturas hay con ncf y sin ncf", "lista de facturas recientes",
            "ver detalles de mis facturas guardadas", "cuanto he vendido en facturas",
            "buscar facturas de este mes", "revisar facturas por sucursal",
            "historial de facturas emitidas", "cuantas facturas tengo registradas",
        ],
    },
    {
        "id": 9,
        "name": "bitacora_create_help",
        "title": "Como registrar una bitacora de recogida",
        "depth": 1,
        "tools": ["check_branches", "check_materials_prices", "check_clients"],
        "patterns": [
            "como registro una bitacora de recogida", "crear nueva bitacora paso a paso",
            "como asigno el camion ficha y chofer en un viaje", "registrar compra de materiales reciclados",
            "pesar carton plastico aluminio en bitacora", "la bitacora suma egreso o ingreso",
            "por que las bitacoras generan un egreso en finanzas",
            "como pongo el precio de compra y venta en bitacora",
            "descargar excel al guardar una bitacora", "vincular parada de ruta con bitacora",
            "agregar varios materiales en una recogida",
        ],
    },
    {
        "id": 10,
        "name": "bitacora_summary_live",
        "title": "Resumen en vivo de bitacoras de recogida",
        "depth": 1,
        "tools": ["check_invoices_bitacoras", "check_branches"],
        "patterns": [
            "cuantas bitacoras tengo registradas", "ultimas bitacoras de recogida",
            "resumen de recogidas y compras", "total comprado en bitacoras",
            "cuantos viajes de recogida llevo", "ver miniaturas de bitacoras",
            "muestrame las bitacoras recientes por sucursal", "que choferes hicieron bitacoras",
            "balance estimado de mis bitacoras", "cuantas recogidas hice",
        ],
    },
    {
        "id": 11,
        "name": "quote_help_and_live",
        "title": "Cotizaciones de items y servicios",
        "depth": 1,
        "tools": ["check_quotes_docs", "check_branches"],
        "patterns": [
            "como hago una cotizacion", "cotizacion de item con descripcion opcional",
            "cotizar un servicio con nombre precio y descripcion",
            "cuantas cotizaciones tengo guardadas", "como agrego un servicio en cotizaciones",
            "convertir cotizacion en factura", "incluir itbis 18 por ciento en cotizacion",
            "vigencia de cotizaciones y terminos importante",
            "ver historial de cotizaciones", "diferencia entre item y servicio en cotizacion",
            "como imprimir pdf de cotizacion",
        ],
    },
    {
        "id": 12,
        "name": "dispatch_conduce_help",
        "title": "Despachos y conduces de entrega",
        "depth": 1,
        "tools": ["check_quotes_docs", "check_branches"],
        "patterns": [
            "como creo un despacho o conduce", "hacer conduce de salida de mercancia",
            "cuantos despachos tengo emitidos", "convertir factura en conduce de entrega",
            "donde registro conductor placa y destino de despacho",
            "imprimir pdf de conduce", "gestion de despachos comerciales",
            "estado de mis conduces",
        ],
    },
    {
        "id": 13,
        "name": "returns_credit_debit_notes",
        "title": "Devoluciones y notas de credito B04 y debito B03",
        "depth": 2,
        "tools": ["check_quotes_docs", "check_ncf_dgii", "check_invoices_bitacoras"],
        "patterns": [
            "como hago una devolucion de venta", "emitir nota de credito b04",
            "crear nota de debito b03", "ncf afectado en nota de credito",
            "anular parcialmente una factura con b04", "como funcionan notas de credito y debito",
            "cuantas notas de credito tengo", "pdf de nota de credito y debito",
            "diferencia entre b03 y b04 dgii",
        ],
    },
    {
        "id": 14,
        "name": "branches_overview_live",
        "title": "Sucursales y ver datos de todas las sucursales",
        "depth": 2,
        "tools": ["check_branches", "check_invoices_bitacoras", "check_clients"],
        "patterns": [
            "ver los datos de todas las sucursales", "cuantas sucursales tengo configuradas",
            "como veo de que sucursal es cada factura y bitacora", "comparar sucursales en historial",
            "como creo una nueva sucursal en la empresa", "asignar usuario o empleado a una sucursal",
            "ubicacion de cada sucursal en facturas y tarjetas", "filtrar historial por sucursal",
            "resumen consolidado por sucursal", "cambiar sucursal activa",
            "cual es la sucursal principal", "datos de sucursales en vivo",
        ],
    },
    {
        "id": 15,
        "name": "clients_manage_live",
        "title": "Gestion de clientes y sucursal asignada",
        "depth": 1,
        "tools": ["check_clients", "check_branches"],
        "patterns": [
            "como creo un cliente y le asigno sucursal", "cuantos clientes tengo registrados",
            "clientes por sucursal", "ver detalles y ubicacion de clientes",
            "como editar o borrar un cliente en supabase", "buscar cliente por nombre o rnc",
            "agregar cliente nuevo con dropdown de sucursal", "lista de clientes activos",
            "clientes sin sucursal asignada", "directorio de clientes",
        ],
    },
    {
        "id": 16,
        "name": "materials_families_audit",
        "title": "Codigos de materiales, familias y auditoria",
        "depth": 2,
        "tools": ["check_materials_prices", "check_invoices_bitacoras"],
        "patterns": [
            "auditar materiales", "revisar codigos de materiales",
            "cuantos materiales y familias tengo", "como creo familias de materiales",
            "asociar codigo de material a una familia", "materiales sin familia asignada",
            "materiales con precio en cero", "eliminar un material en supabase",
            "como configuro carton plastico cobre aluminio hierro",
            "revisar inventario de codigos", "filtrar volumen por familia y material",
        ],
    },
    {
        "id": 17,
        "name": "market_prices_margin",
        "title": "Precios de mercado y calculo de margen",
        "depth": 1,
        "tools": ["check_materials_prices", "run_calculator_or_nav"],
        "patterns": [
            "calcular margen compra a 10 y venta a 18", "precios de mercado de materiales",
            "que ganancia deja comprar a 45 y vender a 60", "cual es mi rentabilidad por libra o kilo",
            "como actualizo precios de compra y venta", "ver tendencia de precios historicos",
            "materiales con margen negativo o bajo", "tabla de precios sugeridos",
            "cuanto gano por tonelada", "margen de ganancia en reciclaje",
        ],
    },
    {
        "id": 18,
        "name": "finance_cashflow_live",
        "title": "Ingresos, egresos y balance financiero en vivo",
        "depth": 2,
        "tools": ["check_finances", "check_branches", "check_invoices_bitacoras"],
        "patterns": [
            "cual es mi balance financiero", "resumen de ingresos y egresos",
            "como va el flujo de caja hoy", "cuanto dinero he ingresado y gastado",
            "graficos estadisticas trading de finanzas", "balance neto en caja",
            "como registro un ingreso o egreso manual", "ver egresos de transporte salarios mantenimiento",
            "ganancia neta del negocio", "ultimos movimientos financieros",
            "por que un gasto de factura se borra al eliminar la factura",
        ],
    },
    {
        "id": 19,
        "name": "tax_math_calculator",
        "title": "Calculadora ITBIS, retenciones y simulacion numerica",
        "depth": 1,
        "tools": ["run_calculator_or_nav"],
        "patterns": [
            "calcula 500 kg a 12", "cuanto es 1200 libras por 15 pesos",
            "simula 350 x 24", "calcular itbis 18 por ciento de 10000",
            "cuanto es el 18 de itbis sobre 5000", "retencion de itbis 30 o 100 por ciento",
            "retencion de isr 2 o 10 por ciento", "formula total factura con isc e itbis",
            "hazme una simulacion de precio por peso", "multiplica 850 lb a 14.5",
        ],
    },
    {
        "id": 20,
        "name": "unit_converter",
        "title": "Conversion de unidades de peso lb kg ton",
        "depth": 0,
        "tools": ["run_calculator_or_nav"],
        "patterns": [
            "convierte 5000 lbs a kg", "cuantos kilos son 2000 libras",
            "pasar 3 toneladas a libras", "convertir 450 kg a lbs",
            "cuantas toneladas son 15000 libras", "conversion de peso reciclaje",
            "cuantas libras tiene un kilogramo", "equivalencia tonelada metrica a libras",
        ],
    },
    {
        "id": 21,
        "name": "routes_agenda_live",
        "title": "Rutas de recogida y agenda de paradas",
        "depth": 1,
        "tools": ["check_routes", "check_branches", "check_collaborators"],
        "patterns": [
            "rutas de recogida programadas", "paradas pendientes en la agenda",
            "como creo una ruta de recoleccion", "recordatorios de rutas en el telefono",
            "convertir parada de ruta en bitacora completada", "cuantas rutas tengo activas",
            "agenda del dia para camiones", "asignar chofer a una ruta",
        ],
    },
    {
        "id": 22,
        "name": "collaborators_roles_live",
        "title": "Colaboradores, empleados, roles y sucursales",
        "depth": 1,
        "tools": ["check_collaborators", "check_branches"],
        "patterns": [
            "cuantos colaboradores o empleados tengo", "agregar nuevo empleado o chofer",
            "anadir empleado a una sucursal", "permisos de administrador vs colaborador",
            "como bloqueo modulos a un empleado", "ver lista de miembros y equipo",
            "roles disponibles para trabajadores", "asignar colaborador a sucursal especifica",
        ],
    },
    {
        "id": 23,
        "name": "pdf_printing_layout",
        "title": "Formato PDF carta ticket 80mm e impresion termica",
        "depth": 1,
        "tools": ["check_branches"],
        "patterns": [
            "estructura de los pdf de facturas y cotizaciones",
            "orden de logo nombre de empresa sucursal y ubicacion en pdf",
            "como imprimir ticket 80mm o 58mm en impresora termica",
            "por que va el logo arriba y al final en la factura pdf",
            "descargar pdf tamano carta de factura o cotizacion",
            "imprimir factura por bluetooth", "compartir factura pdf por whatsapp",
            "como configurar nombre de sucursal y direccion en impresiones",
        ],
    },
    {
        "id": 24,
        "name": "android_control_center",
        "title": "Botones del Centro de Control Android",
        "depth": 1,
        "tools": ["check_control_center"],
        "patterns": [
            "centro de control android", "activar los 2 botones en ajustes",
            "agregar boton bitacora recogida y nueva factura junto al wifi y bluetooth",
            "como pongo los accesos rapidos en la barra de ajustes rapidos",
            "no veo los botones de reciminsa en mi centro de control",
            "tocar el lapiz en android para anadir bitacora recogida y nueva factura",
            "abrir mini bitacora o mini factura rapida", "estado de los botones rapidos android",
        ],
    },
    {
        "id": 25,
        "name": "supabase_sync_delete",
        "title": "Sincronizacion Supabase, offline y eliminacion real",
        "depth": 2,
        "tools": ["check_system_sync"],
        "patterns": [
            "como funciona la sincronizacion con supabase", "cuando borro una factura se borra en supabase",
            "por que no vuelven a aparecer los datos borrados tombstones",
            "trabajar offline sin internet y sincronizar luego", "cola de sincronizacion pendiente",
            "forzar sincronizacion con la nube", "el otro dispositivo no ve los cambios",
            "como verifico si estoy sincronizado", "id de empresa compartido en supabase",
        ],
    },
    {
        "id": 26,
        "name": "gdrive_backup_excel",
        "title": "Respaldo en Google Drive y Excel",
        "depth": 1,
        "tools": ["check_system_sync"],
        "patterns": [
            "respaldo automatico en google drive", "configurar google apps script web app",
            "exportar toda la app a excel xlsx", "importar datos desde excel",
            "probar conexion con google drive", "enviar respaldo de bitacoras a drive ahora",
            "descargar reporte excel personalizado",
        ],
    },
    {
        "id": 27,
        "name": "security_biometric_legal",
        "title": "Seguridad, biometria, privacidad y eliminacion de cuenta",
        "depth": 1,
        "tools": ["check_system_sync"],
        "patterns": [
            "activar huella o biometria para iniciar sesion", "inicio rapido con sqlite y biometria",
            "doble confirmacion antes de borrar datos", "politica de privacidad y terminos legales",
            "como elimino mi cuenta permanentemente", "auditoria de seguridad y log de actividad",
            "proteccion de contrasena y sesion",
        ],
    },
    {
        "id": 28,
        "name": "white_label_settings",
        "title": "Marca blanca, logo, idioma, temas y apariencia",
        "depth": 0,
        "tools": ["check_branches"],
        "patterns": [
            "cambiar el logo y nombre de la empresa marca blanca",
            "cambiar color del tema o modo oscuro claro", "cambiar idioma espanol ingles",
            "al crear empresa va primero el nombre o razon social y luego rnc",
            "personalizar encabezados rnc telefono y correo de la empresa",
            "activar o desactivar modulos en ajustes",
        ],
    },
    {
        "id": 29,
        "name": "ecology_impact_live",
        "title": "Impacto ecologico y sostenibilidad",
        "depth": 1,
        "tools": ["check_invoices_bitacoras", "check_materials_prices"],
        "patterns": [
            "cuantos arboles agua y co2 he ahorrado", "impacto medioambiental del reciclaje",
            "ver reporte ecologico en vivo", "como se calcula el ahorro de energia y co2",
            "toneladas recicladas y impacto verde", "estadisticas de sostenibilidad",
        ],
    },
    {
        "id": 30,
        "name": "system_health_check",
        "title": "Salud de la app, red y almacenamiento local",
        "depth": 2,
        "tools": ["check_system_sync", "check_branches", "check_control_center"],
        "patterns": [
            "salud de la app", "health check del sistema", "estado de la app",
            "cuanta memoria localstorage estoy usando", "estoy online u offline ahora",
            "diagnostico de red y almacenamiento", "limpiar cache de facturas o finanzas",
            "informacion de plataforma android web",
        ],
    },
    {
        "id": 31,
        "name": "navigate_or_open_tool",
        "title": "Navegar a modulo o abrir herramienta rapida",
        "depth": 1,
        "tools": ["run_calculator_or_nav", "check_control_center"],
        "patterns": [
            "ir a historial", "abrir bitacoras", "llevame a facturas",
            "abrir clientes", "ir a ajustes", "navegar a ecologia",
            "abrir ingresos", "ir a egresos", "abrir codigos de materiales",
            "llevame a colaboradores", "abrir manejo dgii", "ir a rutas",
            "abrir mini bitacora ahora", "abrir mini factura ahora",
            "abrir parametrizaciones ncf", "abrir notas de credito",
            "ir a sucursales de empresa",
        ],
    },
    {
        "id": 32,
        "name": "legal_tax_code_ncf",
        "title": "Ley 11-92 Codigo Tributario, Decreto 254-06 y Norma 06-2018 NCF",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_ncf_dgii", "check_invoices_bitacoras"],
        "patterns": [
            "que dice el codigo tributario ley 11 92 sobre comprobantes fiscales",
            "norma 06 2018 ncf vencidos y agotados sanciones dgii",
            "decreto 254 06 regulacion de comprobantes fiscales ncf",
            "cuantos anos debo guardar facturas y documentos segun articulo 50",
            "puedo recuperar itbis con nota de credito b04 despues de 30 dias",
            "si un cliente devuelve mercancia a los 45 dias pierdo el itbis en b04",
            "es ilegal emitir factura con ncf vencido o fuera de rango",
            "multa por facturar sin secuencia autorizada ante la dgii",
            "vigencia legal de dos anos para secuencias de ncf serie b",
            "plazo legal de 30 dias para anulacion y devolucion de itbis b04",
            "por que la ley exige conservar registros contables por 10 anos",
            "debo imprimir factura comercial o fiscal para compras de reciclaje",
            "puedo corregir una factura vieja despues del cierre del mes fiscal",
            "revisar cumplimiento del codigo tributario y secuencias ncf",
            "diferencia legal entre comprobante b01 valido e invalido ante auditoria",
            "consecuencias fiscales de emitir comprobantes vencidos",
        ],
    },
    {
        "id": 33,
        "name": "legal_ecf_electronic_invoicing",
        "title": "Ley 32-23 Facturacion Electronica e-CF Serie E",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_ncf_dgii"],
        "patterns": [
            "que exige la ley 32 23 de facturacion electronica en republica dominicana",
            "cuando es obligatoria la facturacion electronica ecf e31 e32",
            "requisitos legales de firma digital xml y codigo qr en ecf",
            "diferencia legal entre serie b tradicional y serie e electronica",
            "quienes estan obligados segun calendario dgii ley 32 23",
            "validez tributaria de comprobantes e31 e32 e33 e34 e44 e45",
            "puedo emitir e31 sin certificado de firma digital ante dgii",
            "reglamento de implementacion ecf transicion para pymes y grandes",
            "multas o incumplimiento por no migrar a facturacion electronica",
            "como se prepara reciminsaapp para comprobantes e31 serie e",
            "estructura legal de 13 caracteres en comprobantes electronicos ecf",
            "que es un comprobante electronico de credito fiscal e31 y nota e34",
            "representacion impresa ri con codigo qr en factura electronica",
            "transicion legal de facturas serie b a comprobantes electronicos",
        ],
    },
    {
        "id": 34,
        "name": "legal_retentions_itbis_isr",
        "title": "Normas 02-05, 07-07 y 05-2019 Retenciones ITBIS ISR y Calendario",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_ncf_dgii", "check_finances"],
        "patterns": [
            "cuando aplica retencion de 30 por ciento o 100 por ciento de itbis",
            "norma 02 05 y norma 07 07 retencion de itbis entre empresas y personas",
            "cuando retener 2 por ciento o 10 por ciento de isr segun codigo tributario",
            "fecha limite legal para enviar formatos 606 607 y 608 dia 15",
            "fecha limite declaracion jurada it1 dia 20 de cada mes",
            "recargos e intereses indemnizatorios por mora tributaria dgii",
            "compras a recicladores informales personas fisicas y b11",
            "como sustentar legalmente compras de chatarra a proveedores informales",
            "retencion del 100 por ciento del itbis cuando compro sin factura formal",
            "retencion 10 por ciento honorarios profesionales vs 2 por ciento servicios tecnicos",
            "obligaciones mensuales 606 607 608 it1 e ir17",
            "norma 05 2019 sobre tipos especiales de ncf b11 b14 b15",
            "multa por declarar tarde el itbis it1 o formato 607",
            "quien actua como agente de retencion tributaria en ventas y compras",
        ],
    },
    {
        "id": 35,
        "name": "legal_environmental_waste",
        "title": "Ley 64-00 Medio Ambiente y Ley 225-20 Gestion de Residuos",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_invoices_bitacoras", "check_routes"],
        "patterns": [
            "que exige la ley 225 20 de gestion integral de residuos solidos",
            "permisos ambientales ley 64 00 mimarena para centro de acopio y reciclaje",
            "como ayudan las bitacoras y conduces para trazabilidad ambiental mimarena",
            "responsabilidad extendida del productor rep en reciclaje empresarial",
            "diferencia legal entre residuos no peligrosos valorizables y peligrosos",
            "las constancias pdf de impacto ecologico tienen valor de certificacion oficial",
            "sanciones ambientales por transporte o acopio ilegal de desechos",
            "requisitos legales de transporte autorizado de residuos en rutas",
            "autorizacion ambiental para exportar carton plastico o metales reciclados",
            "manifiesto de carga y bitacora de recogida ante inspeccion ambiental",
            "manejo de baterias aceites o desechos peligrosos bajo ley 64 00",
            "cumplimiento ley 225 20 contribucion especial y recicladores",
            "peso reciclado en bitacoras como evidencia de valorizacion",
            "responsabilidad legal si transporto residuos sin conduce ni destino autorizado",
        ],
    },
    {
        "id": 36,
        "name": "legal_corporate_branches_rnc",
        "title": "Ley 479-08 Sociedades Comerciales, Registro Mercantil y Sucursales",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_branches"],
        "patterns": [
            "si abro dos sucursales necesito otro rnc o uso el mismo de la empresa",
            "que dice la ley 479 08 sobre sucursales srl eirl y sas",
            "diferencia legal entre razon social onapi y nombre comercial",
            "diferencia entre sociedad srl y empresa individual eirl",
            "obligacion de renovar registro mercantil en camara de comercio cada dos anos",
            "deben figurar razon social y rnc matriz en todas las facturas de sucursal",
            "formalizar nueva sucursal o establecimiento comercial ante dgii",
            "responsabilidad limitada de socios en una srl recicladora",
            "como se declaran multiples sucursales en la app y ante impuestos internos",
            "uso del registro nacional de contribuyentes unico para multiples locales",
            "requisitos societarios asambleas anuales y acta constitutiva",
            "riesgo legal de facturar sin rnc o razon social en el encabezado",
            "diferencia entre filial independiente y sucursal operativa",
            "nombre comercial certificado por onapi vs denominacion social",
        ],
    },
    {
        "id": 37,
        "name": "legal_commercial_contracts_docs",
        "title": "Validez Juridica de Cotizaciones, Conduces y Documentos Mercantiles",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_quotes_docs", "check_invoices_bitacoras"],
        "patterns": [
            "una cotizacion firmada tiene validez contractual u obligacion legal",
            "el conduce o despacho sustituye a la factura fiscal ante dgii",
            "valor legal del conduce de entrega para probar recepcion de mercancia",
            "plazo de vigencia y terminos legales recomendados en cotizaciones",
            "redacta una clausula legal de validez para mis cotizaciones",
            "como me respaldo legalmente cuando entrego material a credito sin pago",
            "redacta una clausula de mora y jurisdiccion para facturas",
            "consecuencias legales de usar cotizacion como recibo fiscal",
            "requisitos legales de devoluciones mercantiles y aceptacion de carga",
            "codigo de comercio pruebas mercantiles de entrega y aceptacion",
            "clausula de variacion de precios de metales en cotizaciones",
            "proteccion legal ante impagos o disputas de peso en despachos",
            "diferencia juridica entre cotizacion conduce y factura con ncf",
            "terminos comerciales recomendados para contratos de reciclaje",
        ],
    },
    {
        "id": 38,
        "name": "legal_labor_tss_safety",
        "title": "Codigo de Trabajo Ley 16-92, TSS Ley 87-01 e INFOTEP",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_collaborators", "check_routes"],
        "patterns": [
            "registrar empleados en la app sustituye el registro legal en la tss",
            "obligaciones del empleador bajo codigo de trabajo ley 16 92",
            "inscripcion en tss ley 87 01 infotep y riesgos laborales idoppril",
            "diferencia legal entre contrato por tiempo indefinido y contratista independiente",
            "reglas de desahucio preaviso cesantia y regalia pascual navidad",
            "responsabilidad laboral si un chofer se accidenta sin seguro de riesgos tss",
            "uso obligatorio de equipo de proteccion personal epp en acopio de chatarra",
            "nacionalizacion de nomina regla 80 20 codigo de trabajo dominicano",
            "jornada laboral horas extras y descansos para choferes de ruta",
            "riesgo legal de tener colaboradores informales manejando camiones",
            "documentos legales requeridos en expediente de colaborador",
            "como evitar demandas laborales por mal manejo de despidos",
            "diferencia entre permiso de acceso en la app y contrato laboral firmado",
            "aportes mensuales segurididad social sfs afp srl e infotep",
        ],
    },
    {
        "id": 39,
        "name": "legal_data_privacy_cyber",
        "title": "Ley 172-13 Datos Personales, Ley 126-02 Electronica y Ley 53-07",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_clients", "check_system_sync"],
        "patterns": [
            "obligaciones bajo la ley 172 13 de proteccion de datos personales",
            "es legal guardar cedulas telefonos y direcciones de clientes en la nube",
            "consentimiento informado y privacidad de clientes en bases de datos",
            "ley 126 02 sobre validez juridica de documentos y firmas electronicas",
            "ley 53 07 contra crimenes de alta tecnologia y acceso no autorizado",
            "derecho de rectificacion y supresion real de datos personales",
            "como cumplen supabase y tombstones con la eliminacion definitiva de datos",
            "medidas de seguridad recomendadas biometria permisos y copias drive",
            "redacta un aviso corto de privacidad de datos para clientes",
            "riesgo legal de compartir bases de datos de clientes sin autorizacion",
            "control de acceso por roles para evitar fuga de informacion comercial",
            "proteccion legal de respaldo excel y carpetas compartidas google drive",
            "auditoria de eliminaciones y trazabilidad digital en reciminsaapp",
            "cumplimiento de confidencialidad de precios y clientes",
        ],
    },
    {
        "id": 40,
        "name": "legal_aml_scrap_compliance",
        "title": "Ley 155-17 Antilavado y Trazabilidad de Origen en Compra de Chatarra",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_clients", "check_materials_prices", "check_invoices_bitacoras"],
        "patterns": [
            "que riesgos legales tengo si compro cobre o aluminio en efectivo sin cedula",
            "ley 155 17 contra lavado de activos y limites de pagos en efectivo",
            "como evitar problemas legales por comprar cables cobre o chatarra de origen dudoso",
            "requisitos kyc identificacion del proveedor en compras de metales",
            "obligacion de documentar procedencia de metales chatarra y cables",
            "umbrales de transacciones en efectivo bajo ley 155 17 republica dominicana",
            "que pasa si inspeccionan mi patio de chatarra y no tengo bitacora ni cedula",
            "redacta un recibo o declaracion de origen licito para compra de metales",
            "responsabilidad penal por receptacion de material robado sin respaldo",
            "como uso bitacoras y clientes en la app para prevenir riesgos de chatarra",
            "consecuencias legales de compras fraccionadas en efectivo sin soporte",
            "debida diligencia y registro fotografico o documental de vendedores",
            "controles legales en compra de acero cobre bronce y aluminio",
            "auditoria de cumplimiento antilavado y compras informales",
        ],
    },
    {
        "id": 41,
        "name": "legal_audit_risk_scenario",
        "title": "Auditoria Juridica Empresarial, Riesgos y Clausulas ReciminsaApp",
        "depth": 2,
        "tools": ["check_legal_compliance", "check_ncf_dgii", "check_branches", "check_clients", "check_collaborators", "check_system_sync"],
        "patterns": [
            "revisa mi cumplimiento legal empresarial y riesgos dgii en la app",
            "auditoria legal completa de mi empresa en reciminsaapp",
            "que me revisaria un inspector de la dgii o de medio ambiente hoy",
            "cuales son mis principales brechas legales actuales segun mis datos",
            "necesito una evaluacion juridica de mis secuencias clientes y sucursales",
            "que documentos legales debo tener visibles en mi negocio de reciclaje",
            "evalua el riesgo legal de operar sin respaldo ni comprobantes al dia",
            "guia legal integral para operar una empresa recicladora formal en rd",
            "comprueba si cumplo requisitos fiscales ambientales laborales y de datos",
            "checklist legal completo antes de una fiscalizacion empresarial",
            "resumen de cumplimiento normativo corporativo en vivo",
            "redacta terminos y condiciones generales de servicio para reciclaje",
            "ayudame a identificar riesgos legales ocultos en mi configuracion",
            "dame recomendaciones legales accionables basadas en mis datos actuales",
        ],
    },
]

INTENTS: List[str] = [d["name"] for d in INTENT_DEFS]
assert len(INTENTS) == NUM_INTENTS

# Pretraining domain corpus (Stage 1 LM next-token prediction inspired by rasbt/LLMs-from-scratch)
PRETRAINING_CORPUS: List[str] = [
    "reciminsaapp gestiona bitacoras de recogida facturas dgii clientes sucursales y finanzas",
    "cuando una secuencia ncf llega a cero el sistema bloquea la emision fiscal y pide solicitar mas en dgii",
    "sin secuencia ncf activa solo se permite emitir factura comercial interna sin comprobante fiscal",
    "para comprobantes b01 e31 b14 y b15 el rnc de 9 digitos o cedula de 11 digitos es obligatorio",
    "en el historial el boton ver los datos de todas las sucursales muestra facturas bitacoras y clientes por sede",
    "cada tarjeta miniatura y cada modal de detalles indica sucursal y ubicacion exacta de la operacion",
    "al crear un cliente nuevo el dropdown de sucursales permite asignarle en que sucursal compra",
    "todos los pdf llevan logo arriba nombre de empresa sucursal y ubicacion datos cliente consumo y logo final",
    "en cotizaciones un item permite descripcion opcional y un servicio muestra nombre precio y descripcion",
    "en ajustes dentro de centro de control android se activan los botones bitacora recogida y nueva factura",
    "al activar los botones en ajustes android 13 abre el dialogo para fijarlos junto a wifi y bluetooth",
    "la mini bitacora de recogida registra materiales pesos costo compra y sincroniza con supabase",
    "la mini factura rapida valida rnc ncf dgii calcula itbis y guarda el ingreso en supabase",
    "al borrar una factura bitacora cliente material o finanza se ejecuta eliminacion real en supabase y tombstones",
    "los tombstones evitan que los registros eliminados vuelvan a aparecer al sincronizar datos desde supabase",
    "las bitacoras representan recogidas y compras de materiales por eso generan egresos en finanzas",
    "las facturas de venta generan ingresos en finanzas y consumen un numero de secuencia ncf autorizada",
    "los reportes fiscales dgii incluyen formato 606 de compras 607 de ventas 608 de anulados 609 e it1",
    "al anular una factura con ncf el comprobante queda registrado automaticamente en el formato 608",
    "las notas de credito b04 y notas de debito b03 requieren referencia al comprobante fiscal afectado",
    "en parametrizaciones de empresa al crear cuenta va primero nombre o razon social y luego el rnc",
    "en empleados y sucursales se pueden anadir colaboradores directamente a cualquier sucursal",
    "la tabla de codigos de materiales agrupa carton plastico vidrio aluminio cobre hierro y papel por familias",
    "el balance neto en flujo de caja calcula ingresos totales menos egresos totales en pesos dominicanos",
    "el conversor de pesos convierte libras kilogramos y toneladas metricas con factor exacto 2.20462",
    "la calculadora estima itbis 18 por ciento o 16 por ciento retenciones isr y margen por tonelada",
    "el panel de impacto ecologico calcula arboles salvados litros de agua energia kwh y co2 evitado",
    "google drive apps script y exportacion xlsx respaldan facturas bitacoras ingresos egresos y clientes",
    "recibot neo usa transformer multi cabeza lora dpo y rag hibrido con verificacion en vivo multi modulo",
    "recibot flash usa modelo destilado compacto para respuestas rapidas de baja latencia en la app",
    # Corpus Legal Empresarial Dominicano vinculado a ReciminsaApp (pretraining causal)
    "el codigo tributario ley 11 92 regula las obligaciones fiscales de contribuyentes ante la dgii",
    "el decreto 254 06 establece el reglamento para la regulacion de impresiones y comprobantes fiscales ncf",
    "la norma general 06 2018 fija reglas estrictas de secuencia vencimiento y formato de comprobantes ncf",
    "las secuencias autorizadas serie b tienen vigencia ordinaria y no pueden usarse vencidas ni agotadas",
    "emitir comprobante fiscal fuera de secuencia autorizada constituye incumplimiento tributario sancionable",
    "el articulo 50 del codigo tributario ordena conservar libros facturas y documentos por diez anos",
    "para recuperar el itbis mediante nota de credito b04 la anulacion o devolucion debe ocurrir dentro de treinta dias",
    "si una devolucion pasa de treinta dias calendario se pierde el credito fiscal de itbis en b04 segun ley",
    "las notas de credito b04 emitidas despues de treinta dias solo ajustan cuenta por cobrar sin revertir itbis",
    "toda nota de credito b04 o debito b03 debe referenciar obligatoriamente el ncf de la factura original afectada",
    "los comprobantes b01 e31 b14 y b15 exigen validar rnc de nueve digitos o cedula de once digitos",
    "el comprobante b02 consumidor final no otorga credito fiscal ni deduce gasto al comprador empresarial",
    "la ley 32 23 de facturacion electronica implanta el uso progresivo de comprobantes ecf serie e",
    "todo comprobante fiscal electronico e31 e32 e33 e34 requiere firma digital xml y representacion impresa con qr",
    "un ecf serie e cuenta con trece caracteres mientras que un ncf serie b cuenta con once caracteres",
    "la dgii aplica multas por deberes formales cuando una empresa obligada no adopta facturacion electronica",
    "las compras locales a personas fisicas no registradas suelen documentarse mediante comprobante b11 de compras",
    "las normas 02 05 y 07 07 regulan la retencion de itbis de treinta o cien por ciento segun el servicio o bien",
    "al adquirir bienes o servicios gravados de proveedor informal puede aplicar retencion total de cien por ciento itbis",
    "el codigo tributario contempla retencion de isr de dos por ciento en servicios tecnicos y diez por ciento honorarios",
    "el formato 606 de compras 607 de ventas y 608 de anulados vencen hasta el dia quince de cada mes",
    "la declaracion jurada mensual de itbis it1 se presenta y paga a mas tardar el dia veinte de cada mes",
    "los pagos al exterior se reportan en formato 609 y retenciones varias en ir17 segun calendario dgii",
    "presentar tarde el 607 o it1 genera recargos por mora de diez por ciento primer mes e intereses indemnizatorios",
    "reciminsaapp automatiza la generacion de archivos txt 606 607 y 608 para agilizar la oficina virtual dgii",
    "al anular una factura fiscal debe enviarse el comprobante en el formato 608 del mismo periodo mensual",
    "la ley 64 00 sobre medio ambiente exige autorizacion ambiental para centros de acopio y manejo de desechos",
    "la ley 225 20 de gestion integral y coprocesamiento de residuos solidos ordena trazabilidad y registro de gestores",
    "las empresas recicladoras autorizadas deben documentar ingreso y salida de materiales con bitacoras y conduces",
    "la responsabilidad extendida del productor rep fomenta recuperacion trazable de envases carton plastico y vidrio",
    "el transporte de materiales reciclables en rutas debe contar con conduce y destino ambiental habilitado",
    "residuos peligrosos como baterias aceites o solventes requieren manejo diferenciado bajo normas de mimarena",
    "los certificados ecologicos generados en pdf son reportes estimativos informativos y no sustituyen auditorias iso oficiales",
    "registrar cada recogida por peso en bitacoras fortalece las evidencias de valorizacion ante inspecciones ambientales",
    "la ley 479 08 de sociedades comerciales regula srl eirl sas y sociedades anonimas en republica dominicana",
    "una srl sociedad de responsabilidad limitada protege el patrimonio personal de los socios hasta el monto aportado",
    "una eirl empresa individual de responsabilidad limitada separa el patrimonio comercial del patrimonio del unico dueno",
    "las sucursales operativas de una misma empresa comparten el mismo rnc de la sociedad matriz en la dgii",
    "abrir sucursales adicionales requiere informar el domicilio fiscal secundario ante la dgii sin crear otro rnc",
    "el registro mercantil ante la camara de comercio debe renovarse cada dos anos para operar legalmente",
    "onapi registra el nombre comercial mientras la razon social consta en estatutos sociales y acta de dgii",
    "en parametrizaciones de empresa debe aparecer la razon social exacta y el rnc en todo comprobante e impresion pdf",
    "una cotizacion firmada funciona como oferta comercial vinculante mientras no venza su vigencia pero no es comprobante fiscal",
    "un conduce o despacho prueba entrega y recepcion fisica de mercancia segun codigo de comercio pero no sustituye factura ncf",
    "entregar materiales sin conduce firmado o factura deja a la empresa sin prueba documental ante disputas de peso",
    "las cotizaciones de reciclaje deben incluir vigencia limitada porque precios de cobre aluminio y hierro fluctuan diario",
    "una clausula de mora e interes convencional respalda la gestion de cobro de facturas comerciales vencidas",
    "el codigo de trabajo ley 16 92 rige las relaciones laborales jornada descanso vacaciones y terminacion contractual",
    "registrar un empleado o chofer en la app no reemplaza la inscripcion obligatoria ante la tesoreria de seguridad social tss",
    "la ley 87 01 de seguridad social obliga cotizar seguro familiar de salud sfs afp y riesgos laborales idoppril",
    "si un chofer sufre accidente en ruta sin cobertura activa en idoppril y tss el empleador responde civil y laboralmente",
    "el empleador dominicano debe aportar mensualmente a la tss y la contribucion de uno por ciento al infotep",
    "la regla ochenta veinte del codigo de trabajo exige mayoria dominicana en la nomina salvo excepciones legales",
    "el desahucio laboral requiere pago de preaviso y auxilio de cesantia dentro del plazo legal de diez dias",
    "la regalia pascual equivale a la doceava parte del salario ordinario devengado durante el ano calendario",
    "en patios de acopio y manipulacion de chatarra es obligatorio dotar equipos de proteccion personal epp guantes casco calzado",
    "la ley 172 13 protege datos personales incluyendo cedula telefono direccion y registros de clientes y colaboradores",
    "almacenar cedulas o contactos de clientes requiere medidas tecnicas de confidencialidad acceso restringido y respaldo seguro",
    "los respaldos en google drive y exportaciones excel contienen datos sensibles que deben mantenerse en cuentas corporativas privadas",
    "la ley 126 02 otorga validez juridica y fuerza probatoria a documentos digitales registros y firmas electronicas",
    "la ley 53 07 sanciona crimenes de alta tecnologia robo de credenciales acceso ilicito y sabotaje de sistemas",
    "la autenticacion biometrica sqlite y el control de roles protegen el acceso no autorizado a clientes precios y finanzas",
    "cuando un titular ejerce supresion de datos la eliminacion en supabase y tombstones asegura que el registro no reaparezca",
    "la ley 155 17 contra el lavado de activos y financiamiento del terrorismo impone controles estrictos sobre pagos en efectivo",
    "comprar cobre cableado aluminio o metales reciclados en efectivo sin verificar cedula expone a riesgos penales y de comiso",
    "la receptacion de materiales sustraidos de infraestructura electrica o telecomunicaciones acarrea responsabilidad penal",
    "documentar nombre cedula domicilio placa del vehiculo peso y firma del vendedor en bitacora mitiga riesgo de origen ilicito",
    "pagos fraccionados en efectivo para evadir umbrales legales de ley 155 17 constituyen senal de alerta tributaria y antilavado",
    "usar pagos trazables por transferencia o cheque en grandes compras de chatarra fortalece auditorias fiscales y bancarias",
    "una auditoria empresarial revisa cumplimiento conjunto dgii medio ambiente registro mercantil tss proteccion de datos y antilavado",
    "mantener secuencias ncf vigentes clientes con rnc verificado y copias de respaldo reduce sanciones en inspecciones oficiales",
    "recibot neo es argon auditor especialista en razonamiento profundo auditoria legal y verificacion cruzada",
    "recibot flash es pulso agil asistente ligero destilado de neo para respuestas inmediatas en reciminsaapp",
    "ambos modelos operan con un vocabulario expandido de veinte mil tokens y ocho mil ciento noventa y dos buckets fnv",
    "cuando preguntan por su identidad neo responde como argon auditor con enfoque analitico y multipaso",
    "cuando preguntan por su identidad flash responde como pulso agil con respuestas breves directas y veloces",
    "la expansion a veinte mil tokens con embeddings factorizados tipo albert amplia la cobertura semantica en facturacion inventarios flota y derecho corporativo",
    "recibot neo combina embeddings factorizados veinte mil por catorce proyectados a ciento doce transformer gpt lora dpo y rag",
    "recibot flash usa embeddings factorizados veinte mil por ocho pooling mean max y capa oculta destilada con temperatura dos punto cinco",
    "argon auditor verifica coherencia entre facturas ncf balance caja inventario vacio y estado de cumplimiento dgii",
    "pulso agil entrega balance ingresos rutas pendientes y alertas clave en menos de un milisegundo en el navegador",
    "ambas inteligencias artificiales distinguen reciminsaapp de sus variantes de campo manteniendo la seguridad operativa",
    "los usuarios pueden consultar cuantos parametros y tokens tiene cada modelo desde la ventana conversacional",
    "el vocabulario de once mil ochocientos cuatro palabras de dominio mas ocho mil ciento noventa y dos buckets cubre jerga legal y reciclaje",
    "recibot neo explica riesgos laborales contractuales ambientales y tributarios paso a paso con recomendaciones accionables",
    "recibot flash sintetiza recordatorios legales rapidos e indicadores esenciales para decisiones agiles en movimiento",
    "ambos asistentes fueron creados exclusivamente para reciminsaapp y saben responder en primera persona sobre su origen y proposito",
    "el entrenamiento neuronal mezcla pytorch lora dpo y destilacion junto a runtimes en python cpp rust java scala r js julia y mojo",
    "argon auditor y pulso agil funcionan cien por ciento offline en local con pesos cuantizados int8 sin apis externas",
    "durante cada conversacion recibot conserva memoria de seis turnos para interpretar seguimientos sin perder contexto",
    "ni neo ni flash tienen sentimientos conciencia o vida biologica y sus dictamenes son orientacion tecnica y legal",
    "flash alcanza respuestas ultrarrapidas en milisegundos y recomienda pasar a neo para auditorias legales profundas de doce modulos",
    "la version actual de recibot consolida veinte mil tokens compartidos cuarenta y dos intenciones y setenta y siete documentos kb",
    "recibot neo integra quinientos mil quinientos treinta parametros de inferencia y recibot flash ciento setenta y dos mil ochenta y siete parametros ligeros",
    "el ecosistema de reciminsaapp separa claramente la aplicacion principal de reciminsa field y reciminsa ops",
    "cuando alguien pregunta que sabes sobre ti los modelos responden de forma dinamica segun arquitectura memoria limites u origen",
    "cuarenta y dos intenciones y trece herramientas permiten auditar dgii rnc contratos rutas e inventarios en un solo chat",
]

# 40+ Knowledge Base documents for Hybrid RAG (DataTalksClub/llm-zoomcamp BM25 + Vector Retrieval)
KNOWLEDGE_BASE_DOCS: List[Dict] = [
    {
        "id": "kb_neo_flash",
        "intent": "identity_capabilities",
        "title": "Modos ReciBot Neo vs ReciBot Flash",
        "module": "recibot",
        "tags": ["recibot", "neo", "flash", "ia", "modelo", "diferencia", "capacidades"],
        "content": "ReciBot Neo utiliza arquitectura Transformer multi-cabeza entrenada con preentrenamiento ReciminsaApp, LoRA, alineacion DPO y RAG hibrido; ejecuta comprobaciones cruzadas en vivo (NCF DGII, sucursales, finanzas, materiales, sincronizacion) antes de responder. ReciBot Flash usa un modelo destilado liviano optimizado para respuestas instantaneas.",
    },
    {
        "id": "kb_audit_full",
        "intent": "audit_full_app",
        "title": "Auditoria Integral del Sistema ReciminsaApp",
        "module": "auditoria",
        "tags": ["auditoria", "diagnostico", "completo", "legal", "empresa", "fallos"],
        "content": "La auditoria integral inspecciona secuencias NCF DGII agotadas o vencidas, facturas B01/B14/B15 sin RNC valido, sucursales configuradas, clientes/materiales sin asignacion, margenes negativos, flujo de caja y estado de sincronizacion en Supabase.",
    },
    {
        "id": "kb_dgii_ncf_law",
        "intent": "audit_dgii_ncf",
        "title": "Cumplimiento Legal NCF DGII y Bloqueo en Cero",
        "module": "facturas",
        "tags": ["ncf", "dgii", "b01", "b02", "b14", "b15", "e31", "agotada", "vencida", "ilegal"],
        "content": "En Parametrizaciones NCF debes registrar rango inicial, final y fecha de vencimiento autorizados por la DGII. Si una secuencia llega a 0 disponibles o vence, ReciminsaApp bloquea la emision fiscal y exige solicitar nuevos NCF en la DGII o facturar explicitamente como Sin Comprobante Fiscal.",
    },
    {
        "id": "kb_dgii_606_607_608",
        "intent": "dgii_reports_606_607_608",
        "title": "Formatos Fiscales 606, 607, 608, 609 e IT-1",
        "module": "manejo_dgii",
        "tags": ["606", "607", "608", "609", "it1", "txt", "oficina virtual", "anulados"],
        "content": "El modulo Manejo DGII genera archivos TXT oficiales: 606 (compras/costos con NCF), 607 (ventas con NCF emitido), 608 (comprobantes anulados al eliminar o cancelar una factura fiscal) y borrador IT-1 mensual.",
    },
    {
        "id": "kb_dgii_rnc",
        "intent": "dgii_rnc_lookup",
        "title": "Validacion de RNC (9 digitos) y Cedula (11 digitos) DGII",
        "module": "clientes",
        "tags": ["rnc", "cedula", "dgii", "lupa", "validar", "razon social", "9 digitos", "11 digitos"],
        "content": "Usa el boton lupa junto al campo RNC o Nombre en Clientes, Facturas o Mini Factura para consultar el padron DGII en linea. Para comprobantes B01, E31, B14, E44, B15 y E45 es obligatorio un RNC de 9 digitos o Cedula de 11 digitos.",
    },
    {
        "id": "kb_invoice_create",
        "intent": "invoice_create_help",
        "title": "Emision Unificada de Facturas (Fiscal y Comercial)",
        "module": "facturas",
        "tags": ["factura", "emitir", "crear", "b01", "b02", "itbis", "isc", "retencion", "conduce"],
        "content": "En Facturacion -> Facturas puedes emitir con comprobante DGII (si hay lote activo con saldo) o Sin Comprobante Fiscal. Soporta ITBIS 18%/16%/0%, ISC, retenciones de ISR e ITBIS, seleccion de sucursal, PDF Carta o Ticket 80mm y conversion a Conduce.",
    },
    {
        "id": "kb_invoice_summary",
        "intent": "invoice_summary_live",
        "title": "Historial de Facturas Emitidas y Totales",
        "module": "historial",
        "tags": ["facturas", "emitidas", "resumen", "total", "ventas", "sucursal"],
        "content": "Las facturas emitidas se almacenan en recim_invoices con tipo local/empresa, NCF asignado, sucursal de origen y su respectivo movimiento de ingreso en Finanzas.",
    },
    {
        "id": "kb_bitacora_create",
        "intent": "bitacora_create_help",
        "title": "Registro de Bitacoras de Recogida de Materiales",
        "module": "bitacoras",
        "tags": ["bitacora", "recogida", "camion", "ficha", "chofer", "pesos", "egreso"],
        "content": "Las Bitacoras registran recogidas y compras de materiales por sucursal, cliente, chofer y ficha. Al guardar, calculan compra vs venta esperada, registran solo el egreso de compra en Finanzas y sincronizan en Supabase.",
    },
    {
        "id": "kb_bitacora_summary",
        "intent": "bitacora_summary_live",
        "title": "Miniaturas y Resumen de Bitacoras en Vivo",
        "module": "bitacoras",
        "tags": ["bitacoras", "cuantas", "ultimas", "miniaturas", "recogidas", "choferes"],
        "content": "En Bitacoras -> Conteo y Miniaturas puedes inspeccionar cada bitacora con su badge de sucursal, cliente, materiales y total de compra, o ver el consolidado de todas las sucursales.",
    },
    {
        "id": "kb_quotes",
        "intent": "quote_help_and_live",
        "title": "Cotizaciones Ampliadas: Modo Item y Modo Servicio",
        "module": "facturas",
        "tags": ["cotizacion", "cotizaciones", "item", "servicio", "nombre del servicio", "precio", "descripcion"],
        "content": "En Facturacion -> Cotizaciones puedes combinar filas tipo Item (material, cantidad, unidad, precio unitario + descripcion opcional) y filas tipo Servicio (Nombre del Servicio, Precio del Servicio y Descripcion del Servicio) con calculo en vivo de ITBIS y exportacion PDF.",
    },
    {
        "id": "kb_dispatches",
        "intent": "dispatch_conduce_help",
        "title": "Despachos y Conduces de Entrega",
        "module": "facturas",
        "tags": ["despacho", "conduce", "entrega", "placa", "conductor", "pdf"],
        "content": "Los Despachos o Conduces documentan salida fisica de materiales reciclados indicando vehiculo, chofer, sucursal de origen, items entregados y destino.",
    },
    {
        "id": "kb_notes_returns",
        "intent": "returns_credit_debit_notes",
        "title": "Devoluciones, Notas de Credito (B04) y Notas de Debito (B03)",
        "module": "nota_credito",
        "tags": ["devolucion", "nota de credito", "nota de debito", "b03", "b04", "ncf afectado"],
        "content": "Las Notas de Credito (B04) ajustan o anulan ventas referenciando el NCF original afectado; las Notas de Debito (B03) cargan intereses o recargos adicionales con formato DGII completo.",
    },
    {
        "id": "kb_branches",
        "intent": "branches_overview_live",
        "title": "Multi-Sucursal: Ver Todas las Sucursales y Trazabilidad",
        "module": "parametrizaciones_empresa",
        "tags": ["sucursal", "sucursales", "todas", "historial", "empleados", "ubicacion", "razon social"],
        "content": "En Parametrizaciones de Empresa (donde se ingresa primero Nombre/Razon Social y luego RNC) se gestionan sucursales y se anaden usuarios/colaboradores a cada sede. En Historial y Bitacoras el boton 'Ver los datos de todas las sucursales' consolida facturas, bitacoras y clientes por sucursal.",
    },
    {
        "id": "kb_clients",
        "intent": "clients_manage_live",
        "title": "Directorio de Clientes y Sucursal de Compra",
        "module": "clientes",
        "tags": ["cliente", "clientes", "dropdown", "sucursal", "rnc", "editar", "eliminar"],
        "content": "Al crear o editar un cliente en Clientes aparece el selector de sucursal (#cli-branch-select) para asignar en cual sede compra, con filtro por sucursal, vista de detalles con ubicacion y borrado real en Supabase.",
    },
    {
        "id": "kb_materials",
        "intent": "materials_families_audit",
        "title": "Codigos de Materiales, Familias y Auditoria",
        "module": "codigos",
        "tags": ["material", "materiales", "codigo", "familia", "familias", "auditar", "trading"],
        "content": "Cada material debe pertenecer a una Familia de Materiales para habilitar graficos Trading por familia y evitar materiales sin clasificar o con precio $0.00.",
    },
    {
        "id": "kb_prices_margin",
        "intent": "market_prices_margin",
        "title": "Indice de Precios de Mercado y Margen de Rentabilidad",
        "module": "codigos",
        "tags": ["precio", "precios", "margen", "ganancia", "compra", "venta", "tonelada"],
        "content": "ReciminsaApp mantiene precios sugeridos de compra y venta por codigo de material para autocompletar Bitacoras y Facturas, calculando margen bruto por kilo/libra y utilidad por tonelada.",
    },
    {
        "id": "kb_finances",
        "intent": "finance_cashflow_live",
        "title": "Finanzas: Flujo de Caja, Ingresos y Egresos",
        "module": "ingresos",
        "tags": ["finanzas", "balance", "ingreso", "egreso", "flujo", "caja", "neto"],
        "content": "Ingresos registra ventas de facturas y cobros; Egresos registra compras de bitacoras, transporte, salarios y mantenimiento. Al eliminar una factura o bitacora tambien se elimina su movimiento financiero vinculado en Supabase.",
    },
    {
        "id": "kb_calculator",
        "intent": "tax_math_calculator",
        "title": "Calculadora Fiscal ITBIS, Retenciones e Importes",
        "module": "facturas",
        "tags": ["calcular", "itbis", "18", "16", "retencion", "isr", "simula", "multiplicar"],
        "content": "Calculo oficial RD: Subtotal = suma(cantidad * precio), ITBIS = Subtotal * (tasa/100), ISC aplicable segun configuracion, Retencion ISR sobre subtotal y Retencion ITBIS sobre el ITBIS facturado.",
    },
    {
        "id": "kb_unit_conv",
        "intent": "unit_converter",
        "title": "Conversor de Peso Reciclaje (lb, kg, ton)",
        "module": "bitacoras",
        "tags": ["convertir", "libras", "lbs", "kilos", "kg", "toneladas", "ton", "peso"],
        "content": "Factores oficiales: 1 kg = 2.20462 lb, 1 lb = 0.453592 kg, 1 tonelada metrica = 1,000 kg = 2,204.62 lb.",
    },
    {
        "id": "kb_routes",
        "intent": "routes_agenda_live",
        "title": "Rutas de Recogida y Agenda de Paradas",
        "module": "rutas",
        "tags": ["rutas", "agenda", "paradas", "recoleccion", "chofer", "recordatorio"],
        "content": "En Rutas y Agenda planificas paradas con cliente, chofer y fecha; al completar una parada puedes abrir Bitacoras prellenada y marcarla completada automaticamente.",
    },
    {
        "id": "kb_collaborators",
        "intent": "collaborators_roles_live",
        "title": "Colaboradores, Roles, Permisos y Sucursales",
        "module": "colaboradores",
        "tags": ["colaborador", "colaboradores", "empleado", "rol", "permisos", "sucursal", "admin"],
        "content": "En Colaboradores registras choferes y auxiliares con rol y sucursal asignada (boton 'Anadir a sucursal'), controlando permisos por modulo para usuarios no administradores.",
    },
    {
        "id": "kb_pdf_layout",
        "intent": "pdf_printing_layout",
        "title": "Estructura Oficial de PDFs (Carta y Ticket 80mm)",
        "module": "pdf",
        "tags": ["pdf", "ticket", "80mm", "58mm", "termica", "logo", "sucursal", "ubicacion"],
        "content": "Todos los documentos PDF siguen este orden estricto: 1) Logo arriba, 2) Nombre de la empresa + 'Sucursal: [Nombre]' + ubicacion de la sucursal, 3) Datos del cliente, 4) Datos del consumo y totales, 5) Logo de la empresa centrado al final.",
    },
    {
        "id": "kb_control_center",
        "intent": "android_control_center",
        "title": "Centro de Control Android: Bitacora Recogida y Nueva Factura",
        "module": "ajustes",
        "tags": ["centro de control", "android", "ajustes", "tile", "bitacora recogida", "nueva factura", "wifi", "lapiz"],
        "content": "En Ajustes -> Centro de Control Android activas los interruptores 'Bitacora Recogida' y 'Nueva Factura'. En Android 13+ confirma Agregar en el aviso; si tu capa (MIUI/HyperOS o Android < 13) requiere paso manual, desliza el Centro de Control, toca el lapiz arriba a la derecha y anade ambos botones. Abren mini formularios sincronizados con Supabase.",
    },
    {
        "id": "kb_supabase_delete",
        "intent": "supabase_sync_delete",
        "title": "Sincronizacion en Nube Supabase y Eliminacion Real Permanente",
        "module": "sync",
        "tags": ["supabase", "sincronizacion", "borrar", "eliminar", "tombstones", "offline", "nube"],
        "content": "Cada modificacion sincroniza con user_data y tablas de Supabase. Al eliminar factura, bitacora, cliente, material o finanza se borra de Supabase y se registra un tombstone persistente en recim_deleted_tombstones para evitar que reaparezca tras sincronizaciones desde otros dispositivos.",
    },
    {
        "id": "kb_gdrive_excel",
        "intent": "gdrive_backup_excel",
        "title": "Respaldos en Google Drive y Exportacion Excel (.xlsx)",
        "module": "ajustes",
        "tags": ["google drive", "apps script", "backup", "excel", "xlsx", "exportar", "importar"],
        "content": "En Ajustes -> Respaldo en Google Drive vinculas tu carpeta y Google Apps Script para copias automaticas; Herramientas de Datos permite exportar/importar todo en Excel (.xlsx).",
    },
    {
        "id": "kb_security_bio",
        "intent": "security_biometric_legal",
        "title": "Seguridad Biometrica SQLite, Auditoria y Eliminacion de Cuenta",
        "module": "ajustes",
        "tags": ["biometria", "huella", "rostro", "sqlite", "privacidad", "eliminar cuenta", "seguridad"],
        "content": "Ajustes permite activar autenticacion biometrica sobre SQLite local, consultar politicas legales de privacidad, aplicar doble confirmacion en acciones destructivas y eliminar cuenta permanentemente.",
    },
    {
        "id": "kb_white_label",
        "intent": "white_label_settings",
        "title": "Personalizacion Marca Blanca, Temas e Idioma",
        "module": "ajustes",
        "tags": ["marca blanca", "logo", "tema", "oscuro", "claro", "idioma", "modulos"],
        "content": "Desde Ajustes y Parametrizaciones de Empresa personalizas nombre comercial, logo, RNC, tema de color, modo oscuro/claro, idioma (ES/EN) y visibilidad de modulos en el menu lateral.",
    },
    {
        "id": "kb_ecology",
        "intent": "ecology_impact_live",
        "title": "Calculo de Impacto Ecologico (Arboles, Agua, Energia, CO2)",
        "module": "ecologia",
        "tags": ["ecologia", "arboles", "agua", "co2", "energia", "medioambiental", "sostenibilidad"],
        "content": "Calcula arboles salvados (~17 por tonelada de papel/carton), agua preservada, energia electrica ahorrada (kWh) y emisiones de CO2 evitadas segun los pesos reciclados en bitacoras.",
    },
    {
        "id": "kb_health",
        "intent": "system_health_check",
        "title": "Diagnostico de Salud Tecnica de ReciminsaApp",
        "module": "ajustes",
        "tags": ["salud", "health", "diagnostico", "red", "online", "offline", "localstorage", "cache"],
        "content": "Inspecciona conectividad de red, uso de almacenamiento en localStorage, registros cacheados, estado de cola de sincronizacion y plataforma de ejecucion (Android HybridWebView / Windows / Web).",
    },
    {
        "id": "kb_navigation",
        "intent": "navigate_or_open_tool",
        "title": "Navegacion Rapida y Apertura de Herramientas",
        "module": "app",
        "tags": ["ir", "abrir", "navegar", "mini bitacora", "mini factura", "parametrizaciones ncf", "sucursales"],
        "content": "ReciBot puede llevarte a historial, bitacoras, rutas, facturas, nota_credito, nota_debito, manejo_dgii, codigos, clientes, ingresos, egresos, ecologia, colaboradores, parametrizaciones_empresa o ajustes, o abrir directamente Mini Bitacora, Mini Factura o Parametrizaciones NCF.",
    },
    {
        "id": "kb_ncf_e31_ecf",
        "intent": "audit_dgii_ncf",
        "title": "Comprobantes Electronicos Serie E (E31, E32, E44, E45)",
        "module": "facturas",
        "tags": ["e31", "e32", "e44", "e45", "ecf", "serie e", "13 digitos", "dgii"],
        "content": "Los comprobantes electronicos e-CF serie E tienen 13 caracteres (ej. E31 + 10 digitos), a diferencia de la serie B de 11 caracteres (ej. B01 + 8 digitos). ReciminsaApp valida formato estricto antes de emitir.",
    },
    {
        "id": "kb_itbis_retenciones",
        "intent": "tax_math_calculator",
        "title": "Retenciones ISR (2%/10%), Retencion ITBIS (30%/100%) e ISC",
        "module": "facturas",
        "tags": ["retencion", "isr", "itbis", "isc", "porcentaje", "impuestos", "subtotal"],
        "content": "En la factura unificada el ISC y el ITBIS (18% o 16%) se suman sobre el subtotal; la Retencion de ISR se descuenta del subtotal y la Retencion de ITBIS se descuenta del monto de ITBIS.",
    },
    {
        "id": "kb_control_center_xiaomi",
        "intent": "android_control_center",
        "title": "Agregar Botones Rapidos en Xiaomi, Samsung y Android 13+",
        "module": "ajustes",
        "tags": ["xiaomi", "miui", "hyperos", "samsung", "lapiz", "editar", "centro de control", "tile"],
        "content": "En Xiaomi HyperOS/MIUI y Android general, desliza el Centro de Control hacia abajo, pulsa el icono de lapiz (Editar) arriba a la derecha y arrastra 'Bitacora Recogida' y 'Nueva Factura' a la rejilla activa junto a Wi-Fi y Bluetooth.",
    },
    {
        "id": "kb_quote_service_mode",
        "intent": "quote_help_and_live",
        "title": "Modo Servicio en Cotizaciones (Nombre, Precio y Descripcion)",
        "module": "facturas",
        "tags": ["servicio", "cotizacion", "nombre del servicio", "precio del servicio", "descripcion del servicio"],
        "content": "Al marcar Modo Servicio o pulsar '+ Agregar Servicio' en Cotizaciones se muestran los campos Nombre del Servicio, Precio del Servicio y Descripcion del Servicio, ideal para recoleccion o fletes.",
    },
    {
        "id": "kb_quote_item_optional_desc",
        "intent": "quote_help_and_live",
        "title": "Modo Item en Cotizaciones con Descripcion Opcional",
        "module": "facturas",
        "tags": ["item", "material", "descripcion opcional", "cotizacion", "cantidad", "unidad"],
        "content": "Cada fila tipo Item en Cotizaciones registra material, cantidad, unidad y precio unitario, mas un campo opcional para especificaciones de calidad o empaque que aparece debajo del nombre en el PDF.",
    },
    {
        "id": "kb_branches_company_setup",
        "intent": "branches_overview_live",
        "title": "Formulario Crear Empresa (Nombre/Razon Social primero, luego RNC) y Sucursales",
        "module": "parametrizaciones_empresa",
        "tags": ["crear empresa", "razon social", "rnc", "sucursal", "usuarios", "empleados"],
        "content": "Al crear una cuenta empresarial el formulario solicita primero el Nombre o Razon Social y luego el RNC; dentro de Sucursales y Colaboradores puedes asignar usuarios y empleados a sucursales especificas.",
    },
    {
        "id": "kb_mini_bitacora_cc",
        "intent": "bitacora_create_help",
        "title": "Mini Bitacora de Recogida desde Centro de Control Android",
        "module": "bitacoras",
        "tags": ["mini bitacora", "centro de control", "rapida", "supabase", "egreso", "materiales"],
        "content": "El boton Bitacora Recogida abre la Mini Bitacora de Recogida con selector de sucursal, cliente, chofer y materiales con precios sugeridos, guardando en recim_invoices, finanza de egreso y Supabase al instante.",
    },
    {
        "id": "kb_mini_factura_cc",
        "intent": "invoice_create_help",
        "title": "Mini Factura Rapida desde Centro de Control Android",
        "module": "facturas",
        "tags": ["mini factura", "centro de control", "dgii", "rnc", "ncf", "supabase"],
        "content": "El boton Nueva Factura abre la Mini Factura con busqueda DGII de RNC/Nombre, selector de sucursal y validacion NCF obligatoria, consumiendo secuencia y sincronizando la venta directamente a Supabase.",
    },
    {
        "id": "kb_pdf_logo_footer",
        "intent": "pdf_printing_layout",
        "title": "Logo Superior, Sucursal con Ubicacion y Logo Final en PDFs",
        "module": "pdf",
        "tags": ["logo", "pie de pagina", "sucursal", "ubicacion", "pdf", "ticket", "cotizacion"],
        "content": "Tanto las facturas carta con o sin NCF, tickets 80mm, cotizaciones, conduces y notas de credito/debito colocan el logo arriba, seguido de Empresa + Sucursal: [Nombre] + ubicacion, Cliente, Consumo y el logo centrado al final.",
    },
    {
        "id": "kb_delete_cascade_finance",
        "intent": "supabase_sync_delete",
        "title": "Eliminacion en Cascada de Finanzas Vinculadas y Tombstones",
        "module": "sync",
        "tags": ["eliminar", "cascada", "finanzas", "supabase", "tombstones", "resurreccion"],
        "content": "Al eliminar una factura o bitacora tambien se eliminan los ingresos o egresos asociados a su ID, se borra el registro remoto en Supabase y se sincroniza el mapa de tombstones para que ningun equipo lo restaure.",
    },
    {
        "id": "kb_greeting_intro",
        "intent": "greeting",
        "title": "Asistencia Conversacional ReciBot",
        "module": "recibot",
        "tags": ["hola", "buenas", "saludos", "asistente", "ayuda"],
        "content": "ReciBot responde saludos y consultas operativas de ReciminsaApp en modo Neo (razonamiento profundo con verificacion en vivo) o modo Flash (respuesta rapida).",
    },
    {
        "id": "kb_thanks_close",
        "intent": "thanks_farewell",
        "title": "Cierre de Conversacion y Despedida",
        "module": "recibot",
        "category": "app",
        "law_ref": "",
        "tags": ["gracias", "adios", "excelente", "listo", "perfecto"],
        "content": "Confirmacion amable de cierre para agradecimientos o despedidas del operador de ReciminsaApp.",
        "facts": [
            "Cuando agradeces o te despides, ReciBot confirma disponibilidad continua en modo Neo o Flash.",
        ],
    },
    # --- 32 Documentos Legales Empresariales Vinculados a ReciminsaApp (Atomic Facts) ---
    {
        "id": "kb_legal_tax_11_92_ncf",
        "intent": "legal_tax_code_ncf",
        "title": "Codigo Tributario Ley 11-92, Decreto 254-06 y Norma 06-2018 sobre NCF",
        "module": "manejo_dgii",
        "category": "legal",
        "law_ref": "Ley 11-92 · Decreto 254-06 · Norma 06-2018",
        "tags": ["codigo tributario", "ley 11-92", "decreto 254-06", "norma 06-2018", "ncf", "vencido", "agotado", "sancion"],
        "content": "Todo comprobante fiscal serie B debe emitirse dentro del rango numerico y la fecha de vigencia autorizados por la DGII. Emitir NCF agotados o vencidos invalida el credito fiscal del comprador y expone a sanciones por incumplimiento de deberes formales.",
        "facts": [
            "Segun el Decreto 254-06 y la Norma 06-2018, todo NCF emitido debe pertenecer a una secuencia activa y vigente ante la DGII.",
            "Usar secuencias agotadas o vencidas constituye una infraccion formal tributaria (Ley 11-92) e invalida la deduccion de ITBIS/ISR al receptor.",
            "En ReciminsaApp el bloqueo automatico en cero y las alertas de Parametrizaciones NCF impiden emitir NCF agotados o expirados.",
        ],
    },
    {
        "id": "kb_legal_art50_retention_10y",
        "intent": "legal_tax_code_ncf",
        "title": "Conservacion Obligatoria de Libros y Facturas por 10 Anos (Art. 50 Ley 11-92)",
        "module": "historial",
        "category": "legal",
        "law_ref": "Ley 11-92 Art. 50",
        "tags": ["articulo 50", "10 anos", "conservar", "archivo", "libros", "auditoria", "respaldo"],
        "content": "El articulo 50 del Codigo Tributario obliga a conservar facturas, comprobantes, libros contables y soportes digitales durante un minimo de diez anos en soporte legible ante requerimientos de la DGII.",
        "facts": [
            "El Articulo 50 del Codigo Tributario (Ley 11-92) obliga a conservar facturas, comprobantes y registros operativos durante al menos 10 anos.",
            "La falta de respaldo historico o contable ante fiscalizacion puede derivar en determinacion de oficio e imposicion de multas.",
            "ReciminsaApp facilita la preservacion historica combinando Supabase, exportacion anual a Excel (.xlsx) y copias periodicas en Google Drive.",
        ],
    },
    {
        "id": "kb_legal_b04_30days_itbis",
        "intent": "legal_tax_code_ncf",
        "title": "Regla Legal de 30 Dias para Recuperar ITBIS en Notas de Credito B04",
        "module": "nota_credito",
        "category": "legal",
        "law_ref": "Ley 11-92 Art. 338 · Regl. ITBIS 293-11",
        "tags": ["b04", "nota de credito", "30 dias", "itbis", "devolucion", "recuperar", "plazo"],
        "content": "Conforme al Reglamento 293-11 del Codigo Tributario, solo puede deducirse o recuperarse el ITBIS de una venta anulada o devuelta mediante Nota de Credito B04/E34 cuando ocurre dentro de los 30 dias calendario posteriores a la emision de la factura original.",
        "facts": [
            "El Reglamento 293-11 del ITBIS permite recuperar el impuesto facturado con Nota de Credito B04 solo dentro de los 30 dias siguientes a la factura original.",
            "Si la devolucion ocurre despues de 30 dias (ej. 45 o 60 dias), el ajuste contable comercial procede, pero no puedes deducir ese ITBIS en el IT-1.",
            "En ReciminsaApp la Nota de Credito B04 exige vincular el NCF afectado y su fecha para controlar el reporte en el 607 dentro o fuera del plazo.",
        ],
    },
    {
        "id": "kb_legal_b01_vs_b02_vs_none",
        "intent": "legal_tax_code_ncf",
        "title": "Regimen Juridico de B01 Credito Fiscal, B02 Consumo y Documentos Internos",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Norma 06-2018 · Decreto 254-06",
        "tags": ["b01", "b02", "sin comprobante", "credito fiscal", "consumidor final", "rnc", "deducible"],
        "content": "El comprobante B01 sustenta gastos y creditos fiscales de contribuyentes con RNC/Cedula valido; el B02 cubre ventas a consumidores finales sin derecho a credito fiscal. Emitir facturas comerciales sin NCF solo sirve como soporte interno no fiscal y no otorga credito tributario.",
        "facts": [
            "El B01 (o E31) exige RNC de 9 digitos o Cedula de 11 digitos valido para otorgar credito fiscal y gasto deducible al cliente.",
            "El B02 (Consumo) respalda operaciones con consumidor final (y debe reportarse en 607; individual si supera RD$250,000).",
            "La opcion Sin Comprobante Fiscal en ReciminsaApp solo documenta control comercial interno y nunca debe sustituir una obligacion gravada ante DGII.",
        ],
    },
    {
        "id": "kb_legal_ley_32_23_ecf",
        "intent": "legal_ecf_electronic_invoicing",
        "title": "Ley 32-23 de Facturacion Electronica Obligatoria en Republica Dominicana",
        "module": "manejo_dgii",
        "category": "legal",
        "law_ref": "Ley 32-23 · Decreto 587-24",
        "tags": ["ley 32-23", "facturacion electronica", "ecf", "e31", "calendario", "obligatoria", "pymes"],
        "content": "La Ley 32-23 declara obligatorio el uso de Comprobantes Fiscales Electronicos (e-CF) segun calendario gradual por categoria de contribuyente (grandes, medianas y pequenas empresas) fijado por la DGII.",
        "facts": [
            "La Ley 32-23 establece adopcion obligatoria escalonada de e-CF (E31, E32, E33, E34, E44, E45) segun tamano ante la DGII.",
            "Incumplir el plazo asignado acarrea imposibilidad de autorizar comprobantes serie B adicionales y sanciones del Art. 257 del Codigo Tributario.",
            "ReciminsaApp ya soporta estructura Serie E de 13 caracteres (E31/E44/E45) en secuencias y validacion previa de emision.",
        ],
    },
    {
        "id": "kb_legal_ecf_xml_qr_firma",
        "intent": "legal_ecf_electronic_invoicing",
        "title": "Requisitos Tecnicos-Legales de e-CF: Firma Digital, XML y QR",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Ley 32-23 · Ley 126-02",
        "tags": ["firma digital", "xml", "qr", "representacion impresa", "ecf", "certificado"],
        "content": "Un e-CF solo adquiere validez tributaria cuando el archivo XML firmado con certificado digital emitido por una prestadora acreditada recibe aceptacion de la DGII y su representacion impresa exhibe codigo QR de verificacion.",
        "facts": [
            "La validez legal de un e-CF exige XML firmado digitalmente y acuse de aprobacion por el webservice oficial de la DGII.",
            "La Representacion Impresa (RI) en papel o PDF debe mostrar codigo QR y codigo de seguridad para validacion instantanea del cliente.",
            "Mientras no cuentes con certificacion de emisor electronico DGII habilitada, debes operar tus lotes Serie B autorizados en Parametrizaciones.",
        ],
    },
    {
        "id": "kb_legal_norma_02_05_07_07",
        "intent": "legal_retentions_itbis_isr",
        "title": "Reglas Legales de Retencion de ITBIS (30% y 100%) e ISR (2% y 10%)",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Norma 02-05 · Norma 07-07 · Ley 11-92 Art. 309",
        "tags": ["retencion", "itbis", "30", "100", "isr", "2", "10", "agente de retencion"],
        "content": "Las sociedades que contratan servicios profesionales de personas juridicas retienen normalmente el 30% del ITBIS (Norma 02-05); a personas fisicas no acogidas retienen 100% del ITBIS y 10% ISR por honorarios o 2% ISR por servicios tecnicos/transporte (Art. 309).",
        "facts": [
            "Norma 02-05: cuando una sociedad paga servicios gravados a otra entidad juridica puede aplicar retencion del 30% sobre el ITBIS facturado.",
            "Cuando se paga a una persona fisica por servicios gravados o profesionales aplica 100% retencion del ITBIS mas 10% ISR (honorarios) o 2% ISR (servicios tecnicos/mano de obra).",
            "En ReciminsaApp la calculadora y el formulario unificado de Facturas desglosan automaticamente estas retenciones sin alterar el historial.",
        ],
    },
    {
        "id": "kb_legal_dgii_calendar_606_it1",
        "intent": "legal_retentions_itbis_isr",
        "title": "Calendario Fiscal DGII: Formatos 606/607/608 (Dia 15) e IT-1 (Dia 20)",
        "module": "manejo_dgii",
        "category": "legal",
        "law_ref": "Norma 07-2018 · Ley 11-92 Art. 252",
        "tags": ["dia 15", "dia 20", "606", "607", "608", "it1", "mora", "calendario", "plazo"],
        "content": "Los envios informativos 606, 607, 608 y 609 vencen el dia 15 de cada mes; la declaracion y pago del IT-1 e IR-17 vencen el dia 20 (o primer dia habil siguiente). El atraso genera 10% de recargo primer mes, 4% subsiguientes y 1.10% interes mensual.",
        "facts": [
            "Plazo legal mensual DGII: formatos 606, 607, 608 y 609 se remiten hasta el dia 15; IT-1 e IR-17 se declaran y pagan hasta el dia 20.",
            "El retraso tributario activa automaticamente 10% de recargo por mora el primer mes, 4% cada mes o fraccion adicional y 1.10% de interes indemnizatorio mensual.",
            "Manejo DGII en ReciminsaApp consolida tus TXT del mes (606/607/608) para entregarlos antes del dia 15 sin errores de formato.",
        ],
    },
    {
        "id": "kb_legal_informal_b11_purchases",
        "intent": "legal_retentions_itbis_isr",
        "title": "Sustento Fiscal en Compras de Materiales a Recicladores Informales (NCF B11)",
        "module": "bitacoras",
        "category": "hybrid",
        "law_ref": "Norma 05-2019 · Art. 309 Ley 11-92",
        "tags": ["b11", "informal", "reciclador", "chatarra", "compra", "bitacora", "606", "deducible"],
        "content": "Para deducir fiscalmente compras de chatarra o residuos a recolectores informales sin RNC emisor, las empresas utilizan Comprobantes de Compras B11/E41 reportados en el 606 con cedula del proveedor y retenciones aplicables.",
        "facts": [
            "Una bitacora de recogida controla peso, costo y egreso interno, pero para deducibilidad ante DGII la compra informal requiere NCF B11 (Comprobante de Compras).",
            "En B11 es obligatorio identificar cedula del vendedor informal y reportarlo en el Formato 606 evaluando si aplica retencion ISR (2% servicios).",
            "Las Bitacoras de ReciminsaApp guardan cliente/proveedor, ficha, material y peso para conciliar facilmente con tus B11 mensuales.",
        ],
    },
    {
        "id": "kb_legal_ley_225_20_waste",
        "intent": "legal_environmental_waste",
        "title": "Ley 225-20 de Gestion Integral de Residuos Solidos y Gestores Autorizados",
        "module": "bitacoras",
        "category": "legal",
        "law_ref": "Ley 225-20 · Reglamento de Aplicacion",
        "tags": ["ley 225-20", "residuos", "gestor", "autorizado", "valorizacion", "rep", "reciclaje"],
        "content": "La Ley 225-20 regula la cadena de recoleccion, acopio, transporte y valorizacion de residuos solidos, exigiendo autorizacion como gestor ante MIMARENA, trazabilidad documental y registro estadistico de toneladas recuperadas.",
        "facts": [
            "La Ley 225-20 obliga a centros de acopio y recicladores formales a contar con registro y autorizacion ambiental de gestor de residuos ante MIMARENA.",
            "Promueve la Responsabilidad Extendida del Productor (REP) y ordena trazabilidad documental sobre volumenes valorizados vs dispuestos.",
            "ReciminsaApp automatiza el historial de pesos por familia de material (carton, plastico, vidrio, metal) en Bitacoras y Ecologia para tus informes anuales.",
        ],
    },
    {
        "id": "kb_legal_ley_64_00_environmental",
        "intent": "legal_environmental_waste",
        "title": "Ley 64-00 de Medio Ambiente, Permisos MIMARENA y Residuos Peligrosos",
        "module": "rutas",
        "category": "legal",
        "law_ref": "Ley 64-00 Arts. 40, 99, 175",
        "tags": ["ley 64-00", "mimarena", "permiso ambiental", "peligrosos", "acopio", "sancion", "transporte"],
        "content": "La Ley General sobre Medio Ambiente 64-00 exige licencia o permiso ambiental para operar plantas de acopio o reciclaje, prohibe mezclar residuos peligrosos (baterias acido-plomo, aceites usados) sin permiso especial y sanciona el vertido ilegal.",
        "facts": [
            "Segun la Ley 64-00, toda instalacion de acopio, compactacion o transformacion de desechos requiere evaluacion y permiso vigente de MIMARENA.",
            "Manipular o transportar residuos peligrosos (baterias, aceites, electronicos contaminados) sin autorizacion especial acarrea multas administrativas y responsabilidad civil/penal.",
            "Mantener rutas programadas en Rutas-Agenda junto a Conduces de destino autorizado demuestra control operativo limpio ante inspecciones.",
        ],
    },
    {
        "id": "kb_legal_eco_certificates_scope",
        "intent": "legal_environmental_waste",
        "title": "Alcance Juridico de Constancias Ecologicas PDF en ReciminsaApp",
        "module": "ecologia",
        "category": "hybrid",
        "law_ref": "Ley 225-20 · Politica Informativa ReciminsaApp",
        "tags": ["certificado", "ecologia", "pdf", "iso", "informativo", "co2", "constancia"],
        "content": "Las metricas de impacto ecologico (arboles salvados, agua, kWh y CO2 evitado) y constancias PDF de Ecologia son reportes estimativos informativos basados en factores promedio y no sustituyen certificaciones oficiales de MIMARENA ni auditorias ISO.",
        "facts": [
            "Las constancias PDF de Ecologia tienen valor informativo y comercial de respaldo segun pesos registrados, no son certificacion gubernamental MIMARENA ni sello ISO 14001.",
            "Para certificar cumplimiento ambiental oficial ante clientes corporativos se deben anexar licencias MIMARENA vigentes, bitacoras de pesaje y conduces de entrega.",
            "Puedes verificar esta aclaracion legal directamente en Ajustes -> Politicas Legales dentro de la app.",
        ],
    },
    {
        "id": "kb_legal_ley_479_08_entities",
        "intent": "legal_corporate_branches_rnc",
        "title": "Ley 479-08 de Sociedades: SRL, EIRL, SAS y Registro Mercantil",
        "module": "parametrizaciones_empresa",
        "category": "legal",
        "law_ref": "Ley 479-08 (mod. Ley 31-11)",
        "tags": ["ley 479-08", "srl", "eirl", "sas", "registro mercantil", "camara de comercio", "socios"],
        "content": "La Ley 479-08 regula los vehiculos societarios dominicanos (SRL de 2 a 50 socios con responsabilidad limitada; EIRL para dueno unico con patrimonio separado) y exige renovar el Registro Mercantil cada dos anos ante la Camara de Comercio.",
        "facts": [
            "En una SRL o SAS la responsabilidad de los socios se limita a sus aportes de capital; una EIRL permite empresario unico con patrimonio separado del personal.",
            "Toda sociedad formal debe renovar su Registro Mercantil cada 2 anos y presentar declaracion anual de impuesto sobre la renta (IR-2) aunque no tenga movimiento.",
            "Registrar exactamente la Razon Social y RNC de tu entidad en Parametrizaciones de Empresa garantiza coherencia juridica en todos tus PDFs.",
        ],
    },
    {
        "id": "kb_legal_branches_same_rnc",
        "intent": "legal_corporate_branches_rnc",
        "title": "Regimen Tributario y Legal de Sucursales bajo el Mismo RNC Matriz",
        "module": "parametrizaciones_empresa",
        "category": "hybrid",
        "law_ref": "Ley 479-08 · Ley 11-92 · Norma DGII",
        "tags": ["sucursal", "sucursales", "mismo rnc", "otro rnc", "establecimiento", "matriz", "onapi"],
        "content": "Las sucursales operativas de una misma sociedad NO obtienen un RNC distinto: comparten el mismo RNC y Razon Social de la casa matriz ante la DGII, declarando cada local adicional como sucursal o establecimiento.",
        "facts": [
            "Si abres varias sucursales de la misma sociedad no necesitas crear un RNC nuevo: todas operan bajo el RNC unico de la empresa matriz.",
            "Debes notificar cada nueva direccion fisica a la DGII (actualizacion de datos RNC) y en Parametrizaciones puedes distinguir su nombre y ubicacion para impresiones.",
            "Solo si constituyes una compania juridicamente distinta (otra SRL/EIRL) tendra RNC, contabilidad y lotes de NCF independientes.",
        ],
    },
    {
        "id": "kb_legal_onapi_trade_name",
        "intent": "legal_corporate_branches_rnc",
        "title": "Razon Social vs Nombre Comercial ONAPI y Encabezados Obligatorios",
        "module": "parametrizaciones_empresa",
        "category": "legal",
        "law_ref": "Ley 20-00 Propiedad Industrial · Ley 479-08",
        "tags": ["onapi", "nombre comercial", "razon social", "marca", "encabezado", "factura"],
        "content": "El Nombre Comercial protegido por ONAPI identifica al negocio en el mercado, mientras la Razon Social incluye el tipo societario (SRL/EIRL) registrado en DGII; ambos deben corresponderse en facturas y cotizaciones oficiales.",
        "facts": [
            "El certificado de Nombre Comercial en ONAPI otorga exclusividad de marca comercial antes de constituir la sociedad e inscribir el RNC.",
            "Facturar con un nombre comercial distinto al titular del RNC sin respaldo puede provocar rechazo de gastos o notas de reparo por parte de compradores.",
            "ReciminsaApp solicita Razon Social/Nombre y RNC para estampar ambos junto al nombre de sucursal y ubicacion en todos tus PDFs.",
        ],
    },
    {
        "id": "kb_legal_quotes_commercial_validity",
        "intent": "legal_commercial_contracts_docs",
        "title": "Validez Juridica de Cotizaciones y Vigencia de Precios en Reciclaje",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Codigo de Comercio RD · Codigo Civil Art. 1134",
        "tags": ["cotizacion", "oferta", "validez", "vigencia", "contrato", "metales", "clausula"],
        "content": "Una cotizacion aceptada por escrito configura una oferta contractual mercantil vinculante sobre precios y alcance, pero NO constituye factura fiscal ni autoriza traslado sin factura o conduce definitivo.",
        "facts": [
            "Segun el Codigo Civil y de Comercio, una cotizacion aceptada genera obligacion bilateral en precios y terminos descritos mientras este vigente.",
            "Nunca reemplaza una factura con NCF ni sirve para acreditar credito fiscal o deducir ITBIS ante la DGII.",
            "En materiales volatiles (cobre, aluminio, carton) conviene fijar plazo corto de vigencia (ej. 5 o 7 dias) y sujeto a verificacion de peso en bascula.",
        ],
    },
    {
        "id": "kb_legal_conduce_delivery_proof",
        "intent": "legal_commercial_contracts_docs",
        "title": "Valor Probatorio del Conduce o Despacho frente a Impagos y Disputas",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Codigo de Comercio Art. 109",
        "tags": ["conduce", "despacho", "entrega", "prueba", "cobro", "credito", "firma"],
        "content": "El conduce o nota de despacho firmada por el receptor acredita entrega material, cantidad, peso y estado conforme Art. 109 del Codigo de Comercio, siendo prueba clave ante reclamos de impago o diferencias de pesaje.",
        "facts": [
            "El Conduce de entrega firmado con nombre, cedula y fecha demuestra recepcion conforme de los bienes en litigios mercantiles.",
            "Por si solo un conduce no cumple deber tributario de venta; debe facturarse con su NCF correspondiente segun cierre acordado.",
            "En ReciminsaApp puedes convertir cualquier factura o despacho en PDF estructurado con sucursal, conductor, placa y detalle de items.",
        ],
    },
    {
        "id": "kb_legal_credit_collection_clauses",
        "intent": "legal_commercial_contracts_docs",
        "title": "Clausulas de Mora, Ventas a Credito y Retiro de Mercancia",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Codigo de Comercio RD · Codigo Civil Arts. 1153, 1650",
        "tags": ["clausula", "mora", "credito", "cobro", "redacta", "terminos", "disputa"],
        "content": "Pactar por escrito vencimiento de credito, recargo por mora convencional, conformidad de pesaje al retiro y jurisdiccion competente fortalece la recuperacion judicial o extrajudicial de facturas pendientes.",
        "facts": [
            "Las facturas a credito sin fecha de vencimiento ni firma de recepcion dificultan el cobro ejecutivo y el devengo claro de mora.",
            "Incluir aceptacion expresa de peso verificado en bascula certificada evita reclamos posteriores por mermas o humedad.",
            "ReciBot puede redactar clausulas comerciales adaptadas con el nombre y RNC reales configurados en tu empresa.",
        ],
    },
    {
        "id": "kb_legal_labor_16_92_contracts",
        "intent": "legal_labor_tss_safety",
        "title": "Codigo de Trabajo Ley 16-92: Contratos, Jornada, 80/20 y Desahucio",
        "module": "colaboradores",
        "category": "legal",
        "law_ref": "Ley 16-92 Codigo de Trabajo",
        "tags": ["codigo de trabajo", "ley 16-92", "contrato", "desahucio", "cesantia", "preaviso", "regalia", "80/20"],
        "content": "Todo trabajador subordinado en patios o rutas se rige por la Ley 16-92: jornada ordinaria maxima de 44h semanales, regalia pascual obligatoria en diciembre, regla 80/20 de nacionalidad y prestaciones (preaviso y cesantia) pagaderas en 10 dias tras desahucio.",
        "facts": [
            "Si un chofer o auxiliar cumple horario, recibe salario y responde a ordenes de la empresa, existe contrato de trabajo real aunque no se firme papel.",
            "El desahucio sin causa justificada obliga a pagar preaviso, cesantia y derechos adquiridos dentro de los 10 dias siguientes (Art. 86) bajo penalidad diaria.",
            "Ademas exige mantener al menos 80% de empleados dominicanos (Arts. 135-145) y pagar salario de Navidad antes del 20 de diciembre.",
        ],
    },
    {
        "id": "kb_legal_tss_87_01_idoppril",
        "intent": "legal_labor_tss_safety",
        "title": "Tesoreria de Seguridad Social (TSS Ley 87-01), Riesgos Laborales e INFOTEP",
        "module": "colaboradores",
        "category": "hybrid",
        "law_ref": "Ley 87-01 · Ley 397-19 IDOPPRIL · Ley 116-80 INFOTEP",
        "tags": ["tss", "ley 87-01", "idoppril", "riesgos laborales", "infotep", "sfs", "afp", "accidente"],
        "content": "Registrar colaboradores en ReciminsaApp controla accesos operativos por sucursal, pero NO sustituye la inscripcion obligatoria ante la TSS (SUIR+) para SFS, AFP, Seguro de Riesgos Laborales (IDOPPRIL) ni el aporte de 1% al INFOTEP.",
        "facts": [
            "Registrar un empleado en ReciminsaApp es un control interno de software y NO equivale a reportarlo en la planilla oficial de la TSS.",
            "Si un chofer o manipulador de chatarra se accidenta sin afiliacion activa en TSS/IDOPPRIL, la empresa asume gastos medicos, indemnizaciones y multas.",
            "Las novedades de ingreso y salida en TSS deben cargarse en el SUIR+ dentro de los primeros 3 dias habiles para evitar recargos.",
        ],
    },
    {
        "id": "kb_legal_industrial_safety_epp",
        "intent": "legal_labor_tss_safety",
        "title": "Seguridad Ocupacional y EPP Obligatorio en Centros de Acopio (Reglamento 522-06)",
        "module": "colaboradores",
        "category": "legal",
        "law_ref": "Decreto 522-06 Seguridad y Salud en el Trabajo",
        "tags": ["epp", "seguridad", "reglamento 522-06", "chatarra", "casco", "guantes", "accidente"],
        "content": "El Reglamento 522-06 de Seguridad y Salud en el Trabajo exige entregar gratuitamente Equipos de Proteccion Personal (guantes anticorte, botas punta de acero, lentes, faja y chaleco) al personal de acopio y camiones de reciclaje.",
        "facts": [
            "En manipulacion de metales cortantes y carga pesada es obligatorio proveer EPP adecuado y documentar firma de entrega al colaborador.",
            "Incumplir medidas de higiene y seguridad expone a sanciones del Ministerio de Trabajo y recargos en primas de riesgos laborales.",
            "Puedes vincular cada chofer y sucursal asignada en Colaboradores y Rutas para mantener trazabilidad operativa de brigadas.",
        ],
    },
    {
        "id": "kb_legal_ley_172_13_privacy",
        "intent": "legal_data_privacy_cyber",
        "title": "Ley 172-13 de Proteccion de Datos Personales y Derecho de Supresion",
        "module": "clientes",
        "category": "legal",
        "law_ref": "Ley 172-13 Proteccion de Datos Personales",
        "tags": ["ley 172-13", "datos personales", "privacidad", "cedula", "clientes", "consentimiento", "supresion"],
        "content": "La Ley 172-13 protege cedulas, telefonos, correos y direcciones de personas fisicas recolectadas por la empresa, exigiendo finalidad legitima, confidencialidad, seguridad tecnica y atencion a solicitudes de rectificacion o supresion.",
        "facts": [
            "La Ley 172-13 permite recopilar datos de identidad y contacto necesarios para facturacion, entrega y cumplimiento legal sin cederlos a terceros sin consentimiento.",
            "Exige medidas de seguridad razonables contra divulgacion o uso ilicito de listados de clientes y colaboradores.",
            "La eliminacion real en Supabase mas tombstones y la opcion de eliminar cuenta en Ajustes facilitan atender derechos de cancelacion de datos no sujetos a conservacion fiscal.",
        ],
    },
    {
        "id": "kb_legal_ley_126_02_53_07_cyber",
        "intent": "legal_data_privacy_cyber",
        "title": "Ley 126-02 de Comercio Electronico y Ley 53-07 de Delitos de Alta Tecnologia",
        "module": "ajustes",
        "category": "legal",
        "law_ref": "Ley 126-02 · Ley 53-07",
        "tags": ["ley 126-02", "ley 53-07", "alta tecnologia", "firma digital", "seguridad", "acceso", "biometria"],
        "content": "La Ley 126-02 reconoce validez probatoria a mensajes de datos y registros digitales conservados integralmente; la Ley 53-07 penaliza el acceso ilicito, robo de credenciales o alteracion maliciosa de registros contables y bases en la nube.",
        "facts": [
            "Bajo la Ley 126-02 no se niega efecto juridico a registros electronicos de facturas, bitacoras o auditorias por el solo hecho de constar en formato digital.",
            "La Ley 53-07 castiga con prision y multas el acceso indebido a cuentas Supabase/Google Drive, sustraccion de bases de clientes o sabotaje de datos.",
            "Activar bloqueo biometrico SQLite, restringir permisos por rol en Colaboradores y guardar respaldos en cuentas seguras refuerza la defensa legal.",
        ],
    },
    {
        "id": "kb_legal_ley_155_17_aml_cash",
        "intent": "legal_aml_scrap_compliance",
        "title": "Ley 155-17 contra Lavado de Activos, Umbrales en Efectivo y KYC",
        "module": "bitacoras",
        "category": "legal",
        "law_ref": "Ley 155-17 Art. 64 · Normativa UAF",
        "tags": ["ley 155-17", "lavado de activos", "efectivo", "umbral", "kyc", "bancarizacion", "fraccionamiento"],
        "content": "La Ley 155-17 restringe liquidaciones elevadas en efectivo en determinados sectores y sanciona el fraccionamiento deliberado de pagos; ademas exige conocer al proveedor/cliente mediante documento de identidad valido y soporte documental de origen licito.",
        "facts": [
            "Pagar sumas elevadas en efectivo sin soporte ni identificacion o fraccionar facturas para ocultar montos constituye senal critica bajo Ley 155-17.",
            "Para compras recurrentes o de alto valor de metales industriales conviene exigir cedula/RNC verificable y pagar por transferencia bancaria o cheque.",
            "Ademas protege la deducibilidad fiscal del gasto, pues pagos elevados sin medio bancario trazable pueden ser impugnados por la DGII.",
        ],
    },
    {
        "id": "kb_legal_scrap_copper_theft_prevention",
        "intent": "legal_aml_scrap_compliance",
        "title": "Prevencion de Receptacion y Control de Origen en Compra de Cobre y Chatarra",
        "module": "bitacoras",
        "category": "legal",
        "law_ref": "Codigo Penal RD Art. 460 · Ley 155-17",
        "tags": ["cobre", "chatarra", "cable", "robado", "receptacion", "procedencia", "origen licito", "cedula"],
        "content": "Comprar cableado de cobre, bronce, tapas metalicas o chatarra de procedencia ilicita sin exigir identificacion del vendedor ni dejar bitacora firmada expone al patio reciclador al delito de receptacion, comiso del material y cierre.",
        "facts": [
            "Quien adquiere cobre, aluminio o hierro robado (especialmente cableado electrico o telecomunicaciones) responde penalmente por receptacion si omite diligencia minima.",
            "Buenas practicas obligatorias en acopio: exigir cedula o pasaporte vigente, anotar placa del vehiculo, describir el material y conservar recibo/bitacora firmada de origen licito.",
            "En ReciminsaApp debes crear al proveedor en Clientes con su cedula/RNC antes de cerrar la Bitacora de Recogida para mantener trazabilidad completa.",
        ],
    },
    {
        "id": "kb_legal_full_inspection_checklist",
        "intent": "legal_audit_risk_scenario",
        "title": "Checklist Legal Ante Inspeccion de DGII, MIMARENA o Ministerio de Trabajo",
        "module": "auditoria",
        "category": "legal",
        "law_ref": "DGII · MIMARENA · Min. Trabajo · TSS",
        "tags": ["inspeccion", "fiscalizacion", "checklist", "multas", "auditoria legal", "documentos visibles"],
        "content": "Ante una inspeccion empresarial en Republica Dominicana deben estar vigentes: Certificado de RNC y Registro Mercantil visible, secuencias NCF autorizadas sin vencer, envios 606/607/608/IT-1 al dia, permiso ambiental MIMARENA, planilla TSS/IDOPPRIL y protocolos de compra de chatarra.",
        "facts": [
            "Fiscalizacion DGII verifica concordancia entre secuencias NCF emitidas, libros de ventas/compras (607/606), facturas B01 con RNC valido y envios IT-1.",
            "Inspeccion MIMARENA/Trabajo verifica licencia ambiental del patio, EPP al personal, cobertura activa TSS/IDOPPRIL y registro limpio de pesos transportados.",
            "ReciBot Neo cruza en vivo tus NCF, facturas sin RNC, clientes sin identificacion, sucursales y respaldos para estimar tu nivel de riesgo actual.",
        ],
    },
    {
        "id": "kb_legal_general_terms_drafting",
        "intent": "legal_audit_risk_scenario",
        "title": "Diseno Dinamico de Clausulas Legales Comerciales y Declaraciones para Reciclaje",
        "module": "facturas",
        "category": "hybrid",
        "law_ref": "Codigo Civil · Codigo de Comercio · Ley 172-13 · Ley 155-17",
        "tags": ["redacta", "clausula", "terminos", "condiciones", "declaracion", "privacidad", "cotizacion"],
        "content": "ReciminsaApp permite personalizar documentos y ReciBot puede generar borradores orientativos de clausulas de validez de cotizaciones, mora en facturas, aviso de privacidad de datos y declaracion de origen licito de chatarra con el RNC y razon social de tu empresa.",
        "facts": [
            "Toda clausula comercial debe especificar identificacion completa (Razon Social y RNC), vigencia o plazo de pago, aceptacion de peso y jurisdiccion competente.",
            "Las declaraciones de compra de chatarra deben dejar constancia del nombre, cedula y manifestacion de propiedad licita del vendedor bajo fe de juramento.",
            "Los textos generados son borradores practicos de referencia empresarial y deben ser validados por un abogado corporativo para operaciones de gran cuantia.",
        ],
    },
    {
        "id": "kb_legal_cross_app_controls",
        "intent": "legal_audit_risk_scenario",
        "title": "Controles Preventivos Integrados en ReciminsaApp Frente a Errores Legales",
        "module": "auditoria",
        "category": "hybrid",
        "law_ref": "Compliance ReciminsaApp",
        "tags": ["controles", "prevenir", "brechas", "cumplimiento", "compliance", "auditoria"],
        "content": "ReciminsaApp combina candados tecnicos: validacion de 9/11 digitos en RNC para B01/E31, bloqueo de NCF agotados/vencidos, tombstone anti-resurreccion en borrados, asignacion de cliente por sucursal y respaldo en Drive/Excel.",
        "facts": [
            "El mayor riesgo legal en software PYME es emitir NCF ya agotados o asignar credito fiscal B01 sin RNC valido; la verificacion en vivo de ReciBot Neo los detecta al instante.",
            "Otro riesgo comun es mantener clientes sin cedula en compras en efectivo o operar sin respaldo historico para el plazo legal de 10 anos.",
            "Activar Google Drive backup, revisar Parametrizaciones NCF antes de fin de mes y completar RNC de clientes eleva tu indice de cumplimiento.",
        ],
    },
    {
        "id": "kb_legal_tax_penalties_recargos",
        "intent": "legal_tax_code_ncf",
        "title": "Sanciones y Recargos Tributarios por Incumplimiento Formal o Mora (Ley 11-92)",
        "module": "manejo_dgii",
        "category": "legal",
        "law_ref": "Ley 11-92 Arts. 252, 257",
        "tags": ["multa", "sancion", "recargo", "mora", "penalidad", "articulo 257", "dgii"],
        "content": "El incumplimiento de deberes formales tributarios (no emitir comprobante, usar NCF invalidos, no enviar 606/607/608 a tiempo o no actualizar domicilio) conlleva multas de salarios minimos del sector publico ademas de recargos por mora sobre impuestos dejados de pagar.",
        "facts": [
            "Art. 257 del Codigo Tributario sanciona deberes formales con multas pecuniarias de 5 a 30 salarios minimos segun gravedad y reincidencia.",
            "La omision o retraso en pago de impuestos (Art. 252) suma 10% de recargo primer mes, 4% mensual subsiguiente y 1.10% de interes indemnizatorio mensual.",
            "Revisar semanalmente el modulo Manejo DGII y tus alertas de ReciBot Neo previene cierres y penalidades acumulativas.",
        ],
    },
    {
        "id": "kb_legal_accounting_books_audit",
        "intent": "legal_audit_risk_scenario",
        "title": "Correspondencia Contable entre Ingresos, Egresos, Facturas y Bitacoras",
        "module": "ingresos",
        "category": "hybrid",
        "law_ref": "Codigo de Comercio Arts. 8-11 · Ley 11-92",
        "tags": ["contabilidad", "conciliacion", "ingresos", "egresos", "auditoria", "soporte", "balance"],
        "content": "Todo registro financiero en Ingresos y Egresos debe corresponder con un documento de respaldo verificable (factura de venta con NCF, bitacora con recibo/B11 o comprobante de gasto 606) para cuadrar contabilidad y auditoria fiscal.",
        "facts": [
            "Cada movimiento de caja o banco sin factura o soporte 606 valido puede ser rechazado como gasto deducible en la declaracion anual IR-2.",
            "La eliminacion en cascada de finanzas vinculadas en ReciminsaApp evita ingresos o egresos huerfanos tras anular documentos.",
            "Conciliar mensualmente Ingresos vs 607 y Egresos vs 606 garantiza estados financieros consistentes.",
        ],
    },
    {
        "id": "kb_legal_b14_b15_special_regimes",
        "intent": "legal_retentions_itbis_isr",
        "title": "Regimenes Especiales (B14) y Comprobantes Gubernamentales (B15)",
        "module": "facturas",
        "category": "legal",
        "law_ref": "Decreto 254-06 · Norma 05-2019",
        "tags": ["b14", "b15", "zona franca", "regimen especial", "gubernamental", "exento", "retencion estado"],
        "content": "El comprobante B14 (E44) factura ventas exentas de ITBIS a entidades acogidas a regimenes especiales (ej. zonas francas con carnet vigente); el B15 (E45) respalda ventas al Estado dominicano sujeto a retencion del 5% de ISR y normas de compras publicas.",
        "facts": [
            "Al emitir B14 debes verificar la vigencia de la certificacion o carnet de exencion de ITBIS del cliente (zona franca, ley especial) para respaldar la tasa 0%.",
            "Al facturar al Estado con B15 aplica normalmente retencion estatal del 5% de ISR sobre pagos de bienes/servicios (Art. 309 literal e) y reportarlo en el 607.",
            "Ambos tipos de comprobante estan disponibles en Facturacion y exigen RNC de 9 digitos valido.",
        ],
    },
    {
        "id": "kb_legal_b03_debit_notes_law",
        "intent": "legal_tax_code_ncf",
        "title": "Uso Legal de Notas de Debito (B03/E33) para Intereses y Ajustes Positivos",
        "module": "nota_debito",
        "category": "legal",
        "law_ref": "Decreto 254-06 · Norma 06-2018",
        "tags": ["b03", "e33", "nota de debito", "intereses", "mora", "ajuste", "ncf afectado"],
        "content": "Las Notas de Debito B03 (o E33) aumentan legalmente el valor e ITBIS de una factura fiscal previamente emitida por recargos, fletes omitidos, intereses moratorios o diferencias de precio, referenciando siempre el NCF original.",
        "facts": [
            "Nunca debes modificar directamente una factura fiscal ya emitida y reportada en el 607; los incrementos posteriores se documentan con Nota de Debito B03.",
            "El B03 requiere obligatoriamente el NCF original afectado y grava ITBIS si el concepto adicional esta sujeto al impuesto.",
            "ReciminsaApp gestiona las Notas de Debito en su propio modulo vinculandolas al historial y al reporte 607.",
        ],
    },
    {
        "id": "kb_legal_driver_route_liability",
        "intent": "legal_labor_tss_safety",
        "title": "Responsabilidad Civil y Laboral en Rutas de Camiones y Choferes",
        "module": "rutas",
        "category": "hybrid",
        "law_ref": "Codigo Civil Art. 1384 · Ley 63-17 Transito · Ley 87-01",
        "tags": ["chofer", "camion", "accidente", "transito", "ley 63-17", "responsabilidad", "ruta"],
        "content": "Bajo la Ley 63-17 y el Art. 1384 del Codigo Civil, la empresa propietaria del camion es civilmente responsable solidaria por danos en ruta; ademas requiere licencia vigente del chofer, seguro vehicular al dia y cobertura de riesgos laborales IDOPPRIL.",
        "facts": [
            "Todo conductor en rutas de recogida debe portar licencia de categoria acorde al camion, matricula, seguro obligatorio vigente y conduccion segura de carga.",
            "En accidentes viales con carga suelta o sin seguro, la empresa propietaria enfrenta responsabilidad civil directa frente a terceros.",
            "Asignar chofer, ficha vehicular y destino exacto en Rutas y Bitacoras fortalece la supervision de flota.",
        ],
    },
    {
        "id": "kb_identity_neo",
        "intent": "identity_capabilities",
        "title": "Identidad de ReciBot Neo (Argon-Auditor · 20,000 Tokens · 500,530 Params)",
        "module": "chatbot",
        "category": "app",
        "law_ref": "ALBERT Factorized Embeddings 20,000x14->112 + Transformer GPT + LoRA + DPO + RAG",
        "tags": ["recibot neo", "argon auditor", "identidad", "parametros", "500530", "20000 tokens", "factorizado", "razonamiento profundo"],
        "content": "ReciBot Neo es Argón-Auditor, el modelo de razonamiento profundo, auditoría legal empresarial y verificación multi-paso de ReciminsaApp con vocabulario de 20,000 tokens y embeddings factorizados tipo ALBERT (20,000x14 proyectados a 112).",
        "facts": [
            "Identidad oficial de ReciBot Neo: Argón-Auditor, enfocado en precisión, auditoría integral y comprobaciones cruzadas antes de emitir conclusiones.",
            "Arquitectura de ReciBot Neo: Embeddings factorizados ALBERT 20,000x14 -> 112 + Transformer GPT de 2 capas, 4 cabezales, FFN=220, 500,530 parámetros en inferencia, LoRA r=8, DPO y RAG 64D.",
            "ReciBot Neo consulta sus pesos y métricas en vivo (inference_parameters y total_params_with_lora) para informar con exactitud cuántos parámetros contiene.",
        ],
    },
    {
        "id": "kb_identity_flash",
        "intent": "identity_capabilities",
        "title": "Identidad de ReciBot Flash (Pulso-Agil · 20,000 Tokens · 172,087 Params)",
        "module": "chatbot",
        "category": "app",
        "law_ref": "Embedding Factorizado 20,000x8 + Destilacion Ligera",
        "tags": ["recibot flash", "pulso agil", "identidad", "parametros", "172087", "20000 tokens", "velocidad", "destilacion"],
        "content": "ReciBot Flash es Pulso-Ágil, el modelo de respuesta ultrarrápida y ejecución directa destilado desde ReciBot Neo sobre el mismo vocabulario de 20,000 tokens con embeddings factorizados 20,000x8.",
        "facts": [
            "Identidad oficial de ReciBot Flash: Pulso-Ágil, orientado a consultas instantáneas, métricas puntuales y respuestas concisas en milisegundos.",
            "Arquitectura de ReciBot Flash: Embedding factorizado de 20,000 x 8, pooling Mean+Max (16 dimensiones), capa oculta ReLU de 88 neuronas (172,087 parámetros) y cabeza destilada desde ReciBot Neo.",
            "ReciBot Flash responde en primera persona como Pulso-Ágil y muestra el conteo exacto de parámetros de ambos modelos al ser consultado.",
        ],
    },
]

# Guarantee every KB doc has category, law_ref, and non-empty atomic facts for compositional synthesis
for _kb_doc in KNOWLEDGE_BASE_DOCS:
    _kb_doc.setdefault("category", "app")
    _kb_doc.setdefault("law_ref", "")
    if not _kb_doc.get("facts"):
        _raw_parts = [s.strip() for s in _kb_doc["content"].split(". ") if s.strip()]
        _kb_doc["facts"] = [p if p.endswith(".") else p + "." for p in _raw_parts]

# Preference alignment pairs for Stage 3 DPO-style margin optimization
DPO_PREFERENCE_PAIRS: List[Tuple[str, int, int]] = [
    ("puedo hacer una factura b01 sin tener secuencia ncf", 4, 7),
    ("es ilegal emitir comprobante b01 si la secuencia llego a cero", 4, 7),
    ("tengo ncf disponibles para e31 y b02 en la dgii", 4, 8),
    ("cuando se acaba el rango ncf me deja seguir facturando con comprobante", 4, 7),
    ("cuando borro una factura se elimina de verdad en supabase", 25, 8),
    ("los datos eliminados vuelven a aparecer despues de sincronizar", 25, 30),
    ("como borrar un cliente sin que resucite de la nube", 25, 15),
    ("cotizar un servicio con nombre del servicio precio y descripcion", 11, 7),
    ("en cotizaciones un item lleva descripcion opcional", 11, 23),
    ("activar en ajustes los 2 botones del centro de control de android", 24, 28),
    ("poner boton bitacora recogida y nueva factura al lado del bluetooth y wifi", 24, 9),
    ("tocar el lapiz arriba a la derecha en android para agregar accesos rapidos", 24, 30),
    ("ver los datos de todas las sucursales en historial", 14, 8),
    ("donde aparece de que sucursal es cada factura bitacora y cliente", 14, 15),
    ("al crear un cliente quiero asignarle su sucursal en un dropdown", 15, 14),
    ("orden estricto de secciones en factura pdf logo arriba empresa sucursal cliente consumo logo final", 23, 7),
    ("por que la nota de credito b04 requiere ncf afectado", 13, 5),
    ("diferencia entre nota de credito b04 y debito b03", 13, 7),
    ("auditar toda mi empresa legal dgii sucursales y finanzas", 3, 18),
    ("hacer diagnostico completo con comprobaciones de la app", 3, 30),
    ("revisar materiales sin familia y precios en cero", 16, 17),
    ("calcular margen compra 12 venta 20 por kilo", 17, 19),
    ("convertir 3 toneladas a libras", 20, 19),
    ("cuanto es 500 kg por 14 pesos", 19, 17),
    ("generar formato 608 con comprobantes anulados", 5, 4),
    ("validar si el rnc del cliente tiene 9 digitos para credito fiscal b01", 6, 4),
    ("cuantas facturas he emitido hasta hoy", 8, 7),
    ("cuantas bitacoras de recogida tengo registradas", 10, 9),
    ("cual es el balance financiero neto entre ingresos y egresos", 18, 30),
    ("abrir mini bitacora rapida ahora mismo", 31, 9),
    ("abrir mini factura ahora mismo", 31, 7),
    ("llevame a ajustes", 31, 28),
    ("ir al manejo dgii", 31, 5),
    ("que diferencia hay entre recibot neo y recibot flash", 2, 0),
    ("como configuro respaldo automatico en google drive apps script", 26, 25),
    ("activar inicio rapido biometrico con huella", 27, 28),
    # Legal disambiguation DPO pairs
    ("si un cliente devuelve mercancia a los 45 dias pierdo el itbis en b04", 32, 13),
    ("puedo recuperar itbis con nota de credito b04 despues de 30 dias", 32, 19),
    ("cuantos anos debo guardar facturas y documentos segun articulo 50", 32, 8),
    ("norma 06 2018 ncf vencidos o agotados sanciones dgii", 32, 4),
    ("que exige la ley 32 23 de facturacion electronica ecf", 33, 4),
    ("requisitos de firma digital xml y qr en comprobantes e31", 33, 7),
    ("cuando aplica retencion de 30 por ciento o 100 por ciento de itbis", 34, 19),
    ("fecha limite legal para enviar 606 607 608 dia 15 e it1 dia 20", 34, 5),
    ("como sustento compras de chatarra a recicladores informales b11", 34, 9),
    ("permisos ambientales ley 64 00 y ley 225 20 mimarena reciclaje", 35, 29),
    ("las constancias pdf ecologicas son certificacion oficial mimarena iso", 35, 29),
    ("si abro dos sucursales necesito otro rnc o el mismo de la empresa", 36, 14),
    ("que dice la ley 479 08 sobre srl eirl registro mercantil y onapi", 36, 28),
    ("una cotizacion firmada sustituye la factura con ncf ante dgii", 37, 11),
    ("valor legal del conduce de entrega para probar recepcion mercancia", 37, 12),
    ("redacta una clausula legal de validez para mis cotizaciones", 37, 11),
    ("registrar empleados en la app sustituye el registro legal en la tss", 38, 22),
    ("responsabilidad si un chofer se accidenta sin seguro tss idoppril", 38, 21),
    ("obligaciones bajo la ley 172 13 de proteccion de datos personales", 39, 15),
    ("es legal guardar cedulas y contactos de clientes en supabase y drive", 39, 25),
    ("como cumplen supabase y tombstones con la supresion de datos ley 172 13", 39, 25),
    ("riesgos legales si compro cobre en efectivo sin cedula ley 155 17", 40, 17),
    ("como evito comprar cables o chatarra robada receptacion en bitacoras", 40, 9),
    ("redacta un recibo de origen licito para compra de metales cobre", 40, 16),
    ("revisa mi cumplimiento legal empresarial y riesgos dgii en la app", 41, 3),
    ("que me revisaria un inspector de la dgii o de medio ambiente hoy", 41, 3),
    ("checklist legal antes de una inspeccion dgii mimarena y trabajo", 41, 3),
    ("auditoria juridica completa de secuencias rnc clientes y sucursales", 41, 3),
    ("redacta terminos y condiciones legales para factura a credito", 37, 7),
    ("ley 53 07 alta tecnologia y ley 126 02 validez documentos digitales", 39, 27),
    ("quien eres y cual es tu identidad", 2, 0),
    ("cuantos parametros y tokens tiene recibot neo", 2, 3),
    ("diferencia entre argon auditor neo y pulso agil flash", 2, 0),
    ("presentate y dime tu rol en reciminsaapp", 2, 30),
    ("necesitas internet para funcionar o eres offline", 2, 25),
    ("en que lenguajes estas hecho y como te entrenaron", 2, 0),
    ("tienes sentimientos conciencia o cuales son tus limites", 2, 27),
    ("para que app fuiste creado y de que empresa eres", 2, 30),
]


_ACCENT_MAP: Dict[int, int] = {}
for _b in (0xA1, 0x81, 0xA0, 0x80, 0xA4, 0x84, 0xA2, 0x82):
    _ACCENT_MAP[_b] = ord('a')
for _b in (0xA9, 0x89, 0xA8, 0x88, 0xAB, 0x8B, 0xAA, 0x8A):
    _ACCENT_MAP[_b] = ord('e')
for _b in (0xAD, 0x8D, 0xAC, 0x8C, 0xAF, 0x8F, 0xAE, 0x8E):
    _ACCENT_MAP[_b] = ord('i')
for _b in (0xB3, 0x93, 0xB2, 0x92, 0xB6, 0x96, 0xB4, 0x94):
    _ACCENT_MAP[_b] = ord('o')
for _b in (0xBA, 0x9A, 0xB9, 0x99, 0xBC, 0x9C, 0xBB, 0x9B):
    _ACCENT_MAP[_b] = ord('u')
for _b in (0xB1, 0x91):
    _ACCENT_MAP[_b] = ord('n')
for _b in (0xA7, 0x87):
    _ACCENT_MAP[_b] = ord('c')


def normalize_ascii_bytes(text: str) -> bytes:
    raw = str(text or "").encode("utf-8", errors="ignore")
    out = bytearray()
    i = 0
    n = len(raw)
    while i < n:
        b = raw[i]
        if b == 0xC3 and i + 1 < n:
            b2 = raw[i + 1]
            out.append(_ACCENT_MAP.get(b2, 32))
            i += 2
            continue
        if 65 <= b <= 90:
            out.append(b + 32)
        elif (97 <= b <= 122) or (48 <= b <= 57):
            out.append(b)
        else:
            out.append(32)
        i += 1
    return bytes(out)


def tokenize_ascii(text: str) -> List[str]:
    norm = normalize_ascii_bytes(text).decode("ascii")
    return [tok for tok in norm.split(" ") if len(tok) >= 1]


def fnv1a_32(data: bytes) -> int:
    h = 2166136261
    for b in data:
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def build_domain_vocab(max_domain_words: int = NUM_DOMAIN_WORDS) -> Tuple[List[str], Dict[str, int]]:
    """
    Deterministic 20,000-token ReciminsaApp vocabulary:
      0=<PAD>, 1=<UNK>, 2=<CLS>, 3=<SEP>,
      4..11807=11,804 domain & legal/fiscal/numeric tokens (corpus priority + morphological expansion),
      11808..19999=8,192 FNV-1a OOV hash buckets.
    """
    _alnum_re = re.compile(r"[a-z0-9]+")
    counts: Counter = Counter()
    for intent_def in INTENT_DEFS:
        for p in intent_def["patterns"]:
            for tok in tokenize_ascii(p):
                if _alnum_re.fullmatch(tok):
                    counts[tok] += 5
    for sent in PRETRAINING_CORPUS:
        for tok in tokenize_ascii(sent):
            if _alnum_re.fullmatch(tok):
                counts[tok] += 3
    for doc in KNOWLEDGE_BASE_DOCS:
        doc_blob = (
            f"{doc['title']} {doc.get('law_ref', '')} {doc['content']} "
            f"{' '.join(doc.get('tags', []))} {' '.join(doc.get('facts', []))}"
        )
        for tok in tokenize_ascii(doc_blob):
            if _alnum_re.fullmatch(tok):
                counts[tok] += 2
    for text, _, _ in DPO_PREFERENCE_PAIRS:
        for tok in tokenize_ascii(text):
            if _alnum_re.fullmatch(tok):
                counts[tok] += 4

    core_words = [
        w for w, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ][:max_domain_words]
    used = set(core_words)

    ext_candidates: List[str] = []

    def _add_ext(cand: str) -> None:
        if cand not in used and _alnum_re.fullmatch(cand):
            used.add(cand)
            ext_candidates.append(cand)

    if len(core_words) < max_domain_words:
        # 1) Dominican corporate/fiscal/operations codes & domain numbers
        for n in range(1, 18):
            _add_ext(f"b{n:02d}")
            _add_ext(f"ir{n}")
        for n in range(31, 48):
            _add_ext(f"e{n:02d}")
        for code in ("606", "607", "608", "609", "it1"):
            _add_ext(code)
        for yr in range(2010, 2041):
            _add_ext(str(yr))
        for n in range(0, 1501):
            _add_ext(str(n))
        for n in range(2000, 501000, 500):
            _add_ext(str(n))
        for n in range(1, 51):
            _add_ext(f"suc{n}")
            _add_ext(f"camion{n:02d}")
        for n in range(1, 100):
            _add_ext(f"ncf{n:02d}")
            _add_ext(f"lote{n:02d}")
            _add_ext(f"ruta{n:02d}")
        for n in range(1, 101):
            _add_ext(f"cli{n:03d}")

        # 2) Deterministic Spanish & domain morphological expansion from corpus roots
        suffixes = (
            "s", "es", "ar", "er", "ir", "ado", "ada", "ados", "adas",
            "ando", "iendo", "cion", "ciones", "dor", "dora", "dores",
            "mente", "ble", "bles", "ero", "era", "eros", "eras",
            "ista", "istas", "al", "ales", "ivo", "iva", "ivos", "ivas",
            "o", "a", "os", "as", "e", "en", "emos", "an", "amos",
            "aba", "aban", "ara", "aran",
        )
        alpha_roots = [w for w in core_words if w.isalpha() and len(w) >= 4]
        for root in alpha_roots:
            for suf in suffixes:
                _add_ext(f"{root}{suf}")
            if len(core_words) + len(ext_candidates) >= max_domain_words * 2:
                break

        # 3) Fallback deterministic subword prefixes/suffixes if still needed
        if len(core_words) + len(ext_candidates) < max_domain_words:
            for w in sorted(counts.keys()):
                if len(w) >= 3:
                    for L in range(2, min(7, len(w))):
                        _add_ext(w[:L])
                        _add_ext(w[-L:])

    need = max(0, max_domain_words - len(core_words))
    top_words = core_words + sorted(ext_candidates)[:need]

    vocab_list = ["<PAD>", "<UNK>", "<CLS>", "<SEP>"]
    vocab_list.extend(top_words[:max_domain_words])
    while len(vocab_list) < OOV_BUCKET_START:
        vocab_list.append(f"<RESERVED_{len(vocab_list)}>")
    for b_idx in range(OOV_NUM_BUCKETS):
        vocab_list.append(f"<OOV_HASH_{b_idx}>")
    assert len(vocab_list) == VOCAB_SIZE

    word_to_id: Dict[str, int] = {}
    for idx, word in enumerate(vocab_list):
        if 4 <= idx < OOV_BUCKET_START and not word.startswith("<RESERVED_"):
            word_to_id[word] = idx
    return vocab_list, word_to_id


def encode_text(text: str, word_to_id: Dict[str, int], max_seq_len: int = MAX_SEQ_LEN) -> Tuple[List[int], List[int]]:
    """
    Encodes text into fixed-length (token_ids, attention_mask) using exact rules shared across all runtimes.
    Slot 0 is always <CLS> (2), tokens fill up to max_seq_len-1, trailing slots padded with <PAD> (0).
    """
    tokens = tokenize_ascii(text)
    ids = [CLS_ID]
    for tok in tokens:
        if len(ids) >= max_seq_len - 1:
            break
        tid = word_to_id.get(tok)
        if tid is None:
            h = fnv1a_32(tok.encode("ascii", errors="ignore"))
            tid = OOV_BUCKET_START + (h & (OOV_NUM_BUCKETS - 1))
        ids.append(tid)
    if len(ids) < max_seq_len:
        ids.append(SEP_ID)
    mask = [1] * len(ids)
    while len(ids) < max_seq_len:
        ids.append(PAD_ID)
        mask.append(0)
    return ids, mask


def featurize_text(text: str, dim: int = D_IN) -> List[float]:
    norm = normalize_ascii_bytes(text)
    tokens = [tok for tok in norm.split(b" ") if len(tok) >= 2]
    vec = [0.0] * dim
    if not tokens:
        return vec

    def add_feat(feat_bytes: bytes, weight: float) -> None:
        h = fnv1a_32(feat_bytes)
        bucket = h & (dim - 1)
        sign = 1.0 if ((h >> 7) & 1) == 0 else -1.0
        vec[bucket] += sign * weight

    prev = b""
    for tok in tokens:
        add_feat(b"w:" + tok, 2.0)
        if prev:
            add_feat(b"b:" + prev + b"_" + tok, 1.35)
        if len(tok) >= 3:
            padded = b"#" + tok + b"#"
            for k in range(len(padded) - 2):
                add_feat(b"g:" + padded[k : k + 3], 0.55)
        prev = tok

    sq_sum = sum(v * v for v in vec)
    if sq_sum > 1e-12:
        inv_norm = 1.0 / math.sqrt(sq_sum)
        vec = [v * inv_norm for v in vec]
    return vec


_PREFIXES = [
    "", "", "", "por favor ", "oye recibot ", "necesito saber ",
    "quiero ", "ayudame a ", "dime ", "puedes ", "revisa ", "urgente ",
    "en reciminsaapp ", "desde mi celular ", "que pasa si ", "es legal ",
    "me pueden multar si ", "cual es la ley sobre ", "explicame ", "en mi empresa ",
]
_SUFFIXES = [
    "", "", "", " en la app", " por favor", " hoy", " ahora",
    " urgente", " en reciminsa", " rapidamente", " paso a paso",
    " segun la ley", " ante la dgii", " legalmente",
]
_SYNONYMS: List[Tuple[str, str]] = [
    ("factura", "facturas"),
    ("bitacora", "bitacoras"),
    ("bitacora", "recogida"),
    ("sucursal", "sucursales"),
    ("cliente", "clientes"),
    ("material", "materiales"),
    ("cotizacion", "cotizaciones"),
    ("despacho", "conduce"),
    ("colaborador", "empleado"),
    ("rnc", "nit"),
    ("kg", "kilos"),
    ("lbs", "libras"),
    ("borrar", "eliminar"),
    ("ajustes", "configuracion"),
    ("centro de control", "ajustes rapidos"),
    ("ncf", "comprobante fiscal"),
    ("multa", "sancion"),
    ("legal", "juridico"),
    ("ley", "norma"),
    ("chatarra", "metales"),
]
_TYPO_VARS: List[Tuple[str, str]] = [
    ("bitacora", "vitacora"),
    ("recibo", "resibo"),
    ("sucursal", "sucursall"),
    ("facturar", "faturar"),
    ("cotizacion", "cotisacion"),
    ("sincronizacion", "sincronisacion"),
    ("estadisticas", "estadistica"),
    ("diagnostico", "diagnstico"),
]


def _drop_random_stopwords(text: str, rng: random.Random) -> str:
    stops = {"de", "la", "el", "en", "y", "a", "un", "una", "los", "las", "para", "con", "por", "mi", "mis"}
    words = text.split()
    kept = [w for w in words if (w not in stops) or rng.random() > 0.55]
    return " ".join(kept) if kept else text


def _apply_synonym(text: str, rng: random.Random) -> str:
    out = text
    for a, b in _SYNONYMS:
        if f" {a} " in f" {out} " and rng.random() < 0.45:
            out = out.replace(a, b, 1)
            break
    return out


def _apply_typo(text: str, rng: random.Random) -> str:
    out = text
    for clean, typo in _TYPO_VARS:
        if clean in out and rng.random() < 0.5:
            out = out.replace(clean, typo, 1)
            break
    return out


def generate_dataset(seed: int = 42, target_per_intent: int = 120):
    rng = random.Random(seed)
    train_samples: List[Dict] = []
    val_samples: List[Dict] = []

    for intent_def in INTENT_DEFS:
        iid = intent_def["id"]
        iname = intent_def["name"]
        depth = intent_def["depth"]
        tvec = [0.0] * NUM_TOOLS
        for tname in intent_def["tools"]:
            tvec[TOOL_INDEX[tname]] = 1.0

        bases = list(intent_def["patterns"])
        pool: List[Dict] = []
        seen = set()

        for b in bases:
            if b not in seen:
                seen.add(b)
                pool.append({
                    "text": b,
                    "intent_id": iid,
                    "intent_name": iname,
                    "tool_vec": list(tvec),
                    "depth_id": depth,
                })

        attempts = 0
        while len(pool) < target_per_intent and attempts < target_per_intent * 18:
            attempts += 1
            base = rng.choice(bases)
            cand = base
            if rng.random() < 0.60:
                cand = _apply_synonym(cand, rng)
            if rng.random() < 0.35:
                cand = _drop_random_stopwords(cand, rng)
            if rng.random() < 0.15:
                cand = _apply_typo(cand, rng)
            pref_pool = _PREFIXES[:6] if iid in (0, 1, 2) else (_PREFIXES[:14] if iid < 32 else _PREFIXES)
            suff_pool = _SUFFIXES[:7] if iid in (0, 1, 2) else (_SUFFIXES[:11] if iid < 32 else _SUFFIXES)
            full = f"{rng.choice(pref_pool)}{cand}{rng.choice(suff_pool)}".strip()
            if iid in (19, 20) and rng.random() < 0.45:
                n1 = rng.choice([120, 250, 500, 1000, 1500, 2500, 3200, 4800, 6400])
                n2 = rng.choice([8, 12, 15, 18, 22, 35, 60, 75])
                if iid == 19:
                    full = rng.choice([
                        f"calcula {n1} kg a {n2}",
                        f"cuanto es {n1} lbs por {n2} pesos",
                        f"simula {n1} x {n2}",
                        f"itbis 18 por ciento de {n1 * 10}",
                    ])
                else:
                    full = rng.choice([
                        f"convierte {n1} lbs a kg",
                        f"cuantos kilos son {n1} libras",
                        f"pasar {rng.choice([2, 3, 5, 10, 15])} toneladas a libras",
                        f"convertir {n1} kg a lbs",
                    ])
            if full not in seen:
                seen.add(full)
                pool.append({
                    "text": full,
                    "intent_id": iid,
                    "intent_name": iname,
                    "tool_vec": list(tvec),
                    "depth_id": depth,
                })

        # Shuffle unique phrasings per intent and perform clean 80/20 stratified split (0 duplicates across splits)
        rng.shuffle(pool)
        val_k = max(16, int(round(len(pool) * 0.20)))
        val_samples.extend(pool[:val_k])
        train_samples.extend(pool[val_k:])

    pretrain_texts = get_pretraining_sentences()
    rng.shuffle(train_samples)
    rng.shuffle(val_samples)

    meta = {
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "d_in": D_IN,
        "num_intents": NUM_INTENTS,
        "num_tools": NUM_TOOLS,
        "num_depths": NUM_DEPTHS,
        "train_count": len(train_samples),
        "val_count": len(val_samples),
        "pretrain_sentences": len(pretrain_texts),
        "dpo_pairs": len(DPO_PREFERENCE_PAIRS),
        "kb_docs": len(KNOWLEDGE_BASE_DOCS),
        "seed": seed,
    }
    return train_samples, val_samples, meta


def get_pretraining_sentences() -> List[str]:
    sents = list(PRETRAINING_CORPUS)
    for intent_def in INTENT_DEFS:
        for p in intent_def["patterns"]:
            sents.append(p)
        sents.append(f"modulo {intent_def['name'].replace('_', ' ')} {intent_def['title']}")
    for doc in KNOWLEDGE_BASE_DOCS:
        sents.append(f"{doc['title']} {doc.get('law_ref', '')} {doc['content']}")
        for f in doc.get("facts", []):
            sents.append(f)
    return sents


def export_shared_metadata(out_dir: Path | None = None) -> Path:
    if out_dir is None:
        out_dir = Path(__file__).resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)
    _, _, meta = generate_dataset()
    vocab_list, word_to_id = build_domain_vocab()

    vocab_payload = {
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "pad_id": PAD_ID,
        "unk_id": UNK_ID,
        "cls_id": CLS_ID,
        "sep_id": SEP_ID,
        "oov_bucket_start": OOV_BUCKET_START,
        "oov_num_buckets": OOV_NUM_BUCKETS,
        "tokens": vocab_list,
        "word_to_id": word_to_id,
    }
    taxonomy = {
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "d_in": D_IN,
        "identities": MODEL_IDENTITIES,
        "intents": [
            {"id": d["id"], "name": d["name"], "title": d["title"], "depth": d["depth"], "tools": d["tools"]}
            for d in INTENT_DEFS
        ],
        "tools": TOOLS,
        "depth_labels": DEPTH_LABELS,
    }
    (out_dir / "vocab.json").write_text(json.dumps(vocab_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    (out_dir / "taxonomy.json").write_text(json.dumps(taxonomy, indent=2, ensure_ascii=False), encoding="utf-8")
    (out_dir / "reciminsa_kb.json").write_text(json.dumps(KNOWLEDGE_BASE_DOCS, indent=2, ensure_ascii=False), encoding="utf-8")
    (out_dir / "dataset_summary.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return out_dir


if __name__ == "__main__":
    dest = export_shared_metadata()
    summary = json.loads((dest / "dataset_summary.json").read_text(encoding="utf-8"))
    print("SHARED_VOCAB_KB_DATASET_READY:", json.dumps(summary, ensure_ascii=False))
