# Assistente de Queries com IA no Google Sheets

## Como implementar

1. Abra seu Google Sheets e vá em **Extensões > Apps Script**.
2. Copie o conteúdo de `Codigo.gs` e cole no editor.
3. Crie um novo arquivo HTML com o nome `ChatIA` e cole o conteúdo de `ChatIA.html`.
4. Substitua os placeholders:
   - `YOUR_GROQ_API_KEY_HERE` pela sua chave da API da Groq.
   - `YOUR_FOLDER_ID_HERE` pelo ID da pasta onde estão seus arquivos `.sql` ou `.txt`.
5. Salve e atualize a planilha.
6. Use o menu "🧠 Assistente de Queries" para abrir o chat ou atualizar o catálogo.

---

Dica: você pode ajustar o número de descrições enviadas para a IA ou o modelo utilizado na função `consultarIA`.
