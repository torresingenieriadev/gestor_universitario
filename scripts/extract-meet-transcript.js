/**
 * Script para extraer la transcripcion de Google Meet/Google Drive
 * 
 * INSTRUCCIONES PASO A PASO:
 * 
 * 1. Abre la transcripcion en Google Meet o Google Drive
 * 2. Haz scroll hasta arriba y hasta abajo para cargar TODOS los segmentos
 * 3. Abre la consola del navegador: F12 → pestaña "Console"
 * 4. Si ves un warning rojo que dice "Warning: Don't paste code...", escribe:
 *    allow pasting
 *    (y presiona Enter para desbloquear el pegado)
 * 5. Pega este script completo en la consola y presiona Enter
 * 6. El texto limpio se copiara automaticamente al portapapeles
 * 7. Vuelve a la app y pegalo en "Pegar Texto"
 * 
 * El script extrae todos los segmentos, elimina timestamps y UI artifacts.
 */

(function() {
    var segments = document.querySelectorAll('.JnEIr, [jsname="Eqn5fb"]');
    if (segments.length === 0) {
        console.error('No se encontraron segmentos. Asegurate de hacer scroll en la transcripcion para cargar todo.');
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
        console.error('Sin texto encontrado. Haz scroll completo en la transcripcion.');
        return;
    }

    var result = lines.join('\n');

    navigator.clipboard.writeText(result).then(function() {
        console.log('✅ Transcripcion extraida: ' + lines.length + ' segmentos, ' + result.length + ' caracteres.');
        console.log('Texto copiado al portapapeles. Pegalo en la app.');
    }).catch(function() {
        console.log('⚠️ No se pudo copiar automaticamente. Selecciona y copia manualmente el texto de abajo:');
        console.log(result);
    });
})();
