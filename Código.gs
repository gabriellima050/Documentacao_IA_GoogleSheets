// Chave da API Groq para chamada à IA (NÃO compartilhe publicamente!)
// Substitua pela sua chave localmente antes de rodar.
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';

// Função executada automaticamente ao abrir a planilha.
// Cria um menu personalizado para facilitar o uso das funções.
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🧠 Assistente de Scripts")
    .addItem("🔄 Atualizar Catálogo", "catalogarScriptsComDescricaoGroq") // Atualiza lista de scripts e gera descrições
    .addItem("💬 Abrir Chat com IA", "abrirChatIA") // Abre uma interface para consultar scripts via IA
    .addToUi();
}

// Função principal para catalogar scripts na planilha e gerar descrições via IA.
function catalogarScriptsComDescricaoGroq() {
  // Obtém a pasta do Google Drive pelo ID informado (pasta raiz do catálogo)
  const pasta = DriveApp.getFolderById('1CAyhhILwhr4MUcRVm7gtNmG9YHaf9hAr');

  // Busca recursivamente todos os arquivos dentro da pasta e suas subpastas
  const arquivos = getAllFilesRecursivo(pasta);

  // Obtém a planilha ativa e cria/seleciona a aba chamada 'Catalogo'
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName('Catalogo') || planilha.insertSheet('Catalogo');

  // Se a aba estiver vazia, insere cabeçalho
  if (aba.getLastRow() === 0) {
    aba.appendRow(['Nome do Arquivo', 'Descrição do Script', 'Link', 'Data de Modificação']);
  }

  // Carrega dados já existentes na planilha para evitar duplicatas e atualizações desnecessárias
  let dadosExistentes = [];
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha > 1) {
    dadosExistentes = aba.getRange(2, 1, ultimaLinha - 1, 4).getValues();
  }

  // Mapeia os arquivos existentes para facilitar busca por nome
  const mapaArquivos = {};
  dadosExistentes.forEach((row, i) => {
    mapaArquivos[row[0]] = {
      rowIndex: i + 2,       // Linha na planilha onde o arquivo está listado
      descricao: row[1],     // Descrição atual do script
      link: row[2],          // Link para o arquivo no Drive
      dataModificacao: row[3]// Data da última modificação registrada
    };
  });

  let novosInseridos = 0;
  let atualizados = 0;

  // Define quais extensões de arquivos serão processadas
  const extensoesSuportadas = ['.sql', '.txt', '.py', '.js', '.gs', '.html'];

  // Itera por todos os arquivos encontrados na pasta (e subpastas)
  for (let arquivo of arquivos) {
    const nome = arquivo.getName();
    const extensao = nome.slice(nome.lastIndexOf('.')).toLowerCase();

    Logger.log('Arquivo: ' + nome + ' | Extensão: ' + extensao);

    // Ignora arquivos com extensões não suportadas
    if (!extensoesSuportadas.includes(extensao)) {
      Logger.log('Ignorando arquivo não suportado: ' + nome);
      continue;
    }

    // Dados do arquivo
    const link = arquivo.getUrl();
    const dataModificacao = arquivo.getLastUpdated();
    const registro = mapaArquivos[nome]; // Verifica se já existe registro para esse arquivo

    if (registro) {
      // Se já existe, atualiza link e data na planilha
      const row = registro.rowIndex;
      aba.getRange(row, 3).setValue(link);
      aba.getRange(row, 4).setValue(dataModificacao);

      // Se descrição estiver vazia, gera nova descrição via IA
      const descricaoPreenchida = registro.descricao && registro.descricao.toString().trim() !== '';
      if (!descricaoPreenchida) {
        const conteudo = DriveApp.getFileById(arquivo.getId()).getBlob().getDataAsString();
        if (conteudo.trim().length > 30) {
          const descricao = gerarDescricaoGroq(conteudo, extensao);
          aba.getRange(row, 2).setValue(descricao);
        } else {
          aba.getRange(row, 2).setValue('Arquivo muito curto para análise');
        }
      }

      atualizados++;
      continue;
    }

    // Se arquivo é novo, gera descrição e insere na planilha
    let descricao = '';
    const conteudo = DriveApp.getFileById(arquivo.getId()).getBlob().getDataAsString();
    if (conteudo.trim().length > 30) {
      descricao = gerarDescricaoGroq(conteudo, extensao);
    } else {
      descricao = 'Arquivo muito curto para análise';
    }

    aba.appendRow([nome, descricao, link, dataModificacao]);
    novosInseridos++;

    // Aguarda 30 segundos para evitar rate limit da API Groq
    Utilities.sleep(30000);
  }

  // Mostra resumo da atualização para o usuário
  SpreadsheetApp.getUi().alert(
    `✅ Catálogo atualizado!\n\n🆕 Novos arquivos inseridos: ${novosInseridos}\n♻️ Arquivos atualizados: ${atualizados}`
  );
}

// Função recursiva para obter todos os arquivos dentro de uma pasta e suas subpastas
function getAllFilesRecursivo(pasta) {
  const arquivos = [];
  const arquivosDiretos = pasta.getFiles();
  while (arquivosDiretos.hasNext()) {
    arquivos.push(arquivosDiretos.next());
  }

  const pastas = pasta.getFolders();
  while (pastas.hasNext()) {
    const subpasta = pastas.next();
    arquivos.push(...getAllFilesRecursivo(subpasta));
  }

  return arquivos;
}

// Gera descrição do conteúdo do script usando a API Groq (OpenAI)
function gerarDescricaoGroq(texto, extensao) {
  const partes = [];
  const tamanhoMaximo = 20000;

  // Divide texto em pedaços para respeitar limite de tokens da API
  for (let i = 0; i < texto.length; i += tamanhoMaximo) {
    partes.push(texto.substring(i, i + tamanhoMaximo));
  }

  const respostas = [];

  // Para cada parte do texto, faz chamada à API para gerar descrição
  for (let p = 0; p < partes.length; p++) {
    const prompt = `Explique de forma simples e direta o que este script (${extensao}) faz. Evite termos técnicos e seja objetivo:\n\n${partes[p]}`;

    let respostaParte = '';
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const resposta = UrlFetchApp.fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + GROQ_API_KEY },
          payload: JSON.stringify({
            model: "llama3-70b-8192",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 600,
            temperature: 0.3
          }),
          muteHttpExceptions: true
        });

        const resultado = JSON.parse(resposta.getContentText());
        if (resultado?.choices?.length > 0) {
          respostaParte = resultado.choices[0].message.content.trim();
          break; // Sai do loop de tentativas se tiver resposta válida
        }
      } catch (e) {
        Logger.log("Erro na chamada da API Groq: " + e.message);
      }
    }

    // Se não conseguiu obter resposta após tentativas, retorna vazio
    if (respostaParte === '') return '';

    respostas.push(respostaParte);
  }

  // Junta as partes da resposta em um texto único
  return respostas.join('\n\n');
}

// Abre uma janela de diálogo no Sheets com interface para chat com IA
function abrirChatIA() {
  const html = HtmlService.createHtmlOutputFromFile('ChatIA')
    .setWidth(400)
    .setHeight(450);
  SpreadsheetApp.getUi().showModalDialog(html, '💬 Chat com IA sobre Scripts');
}

// Consulta a IA com a pergunta do usuário para buscar scripts relevantes
function consultarIA(perguntaUsuario) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Catalogo");
  if (!aba) return "❌ Aba 'Catalogo' não encontrada.";

  // Pega dados da planilha (nome, descrição e link)
  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, 3).getValues();

  // Palavras comuns para ignorar na busca
  const stopwords = ['a','o','e','de','do','da','em','com','para','é','que','qual','quais','tem','sobre','alguma','algum'];

  // Separa pergunta em palavras relevantes filtrando stopwords
  const palavras = perguntaUsuario.toLowerCase().split(/\W+/).filter(p => p && !stopwords.includes(p));

  // Filtra scripts que contenham alguma das palavras na descrição ou no nome
  const dadosFiltrados = dados.filter(row => {
    const nome = (row[0] || '').toLowerCase();
    const descricao = (row[1] || '').toLowerCase();
    return palavras.some(p => nome.includes(p) || descricao.includes(p));
  });

  if (dadosFiltrados.length === 0) return "⚠️ Nenhum script relacionado encontrado.";

  // Monta lista formatada para enviar à IA
  const descricoes = dadosFiltrados.slice(0, 40)
    .map(r => `${r[0]}\nLink: ${r[2]}`)
    .join('\n\n');

  // Prompt para IA buscar e sugerir scripts relevantes
  const prompt = `Você é um assistente que ajuda a encontrar scripts úteis com base nas descrições abaixo. 
Responda à pergunta do usuário indicando quais arquivos são relevantes. Use lista numerada com nome e link.

Pergunta: ${perguntaUsuario}
Scripts disponíveis:
${descricoes}`;

  try {
    // Chamada para a API Groq (OpenAI)
    const resposta = UrlFetchApp.fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + GROQ_API_KEY },
      payload: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.3
      }),
      muteHttpExceptions: true
    });

    const resultado = JSON.parse(resposta.getContentText());
    return resultado?.choices?.[0]?.message?.content?.trim() || "⚠️ A IA não retornou resposta válida.";
  } catch (e) {
    return "❌ Erro ao chamar a IA: " + e.message;
  }
}
