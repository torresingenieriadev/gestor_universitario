/**
 * Script para extraer la transcripción de Google Meet/Google Drive
 * 
 * INSTRUCCIONES:
 * 1. Abre la transcripción en Google Meet o Google Drive
 * 2. Abre la consola del navegador (F12 → Console)
 * 3. Pega este script completo y presiona Enter
 * 4. El texto limpio se copiará automáticamente al portapapeles
 * 
 * El script extrae todos los segmentos de la transcripción,
 * elimina timestamps y UI artifacts, y formatea el texto limpio.
 */

(function() {
    var segments = document.querySelectorAll('.JnEIr, [jsname="Eqn5fb"]');
    if (segments.length === 0) {
        console.error('No se encontraron segmentos de transcripción. Asegúrate de que la transcripción esté visible en pantalla.');
        return;
    }

    var lines = [];
    segments.forEach(function(seg) {
        var textEl = seg.querySelector('.wyBDIb');
        if (textEl) {
            var text = textEl.textContent.trim();
            if (text) {
                lines.push(text);
            }
        }
    });

    if (lines.length === 0) {
        console.error('Se encontraron segmentos pero sin texto. Intenta hacer scroll en la transcripción para cargar más contenido.');
        return;
    }

    var result = lines.join('\n');

    navigator.clipboard.writeText(result).then(function() {
        console.log('✅ Transcripción extraída: ' + lines.length + ' segmentos, ' + result.length + ' caracteres.');
        console.log('El texto ha sido copiado al portapapeles.');
    }).catch(function() {
        console.log('⚠️ No se pudo copiar automáticamente. Aquí está el texto:');
        console.log(result);
    });
})();
