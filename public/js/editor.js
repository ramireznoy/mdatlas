CodeMirror.defineMode('markdown-enhanced', config =>
  CodeMirror.overlayMode(
    CodeMirror.getMode(config, 'markdown'),
    {
      token(stream) {
        if (stream.sol() && stream.match(/^\s*(?:[-*+]|\d+\.)\s/))
          return 'list-marker';
        stream.skipToEnd();
        return null;
      },
    }
  )
);

export function createEditor(container, { value, dark, onChange }) {
  const cm = CodeMirror(container, {
    value,
    mode:           'markdown-enhanced',
    theme:          dark ? 'dracula' : 'default',
    lineNumbers:    false,
    lineWrapping:   true,
    autofocus:      true,
    indentUnit:     2,
    tabSize:        2,
    viewportMargin: Infinity,
    // Save (⌘/Ctrl+S) and Read/Edit (⌘/Ctrl+I) are handled by the window-level
    // shortcut handler in app.js; binding them here too would run them twice.
    extraKeys: {
      Tab: cm => cm.replaceSelection('  '),
    },
  });
  cm.on('change', instance => onChange?.(instance.getValue()));
  return cm;
}
