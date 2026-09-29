# Painel acadêmico · Polo 1740

Site simples (sem servidor próprio) para a coordenação acompanhar o calendário do Semipresencial e do EAD: semana, calendário do mês, professores, conferência de erros (incluindo choque de professor e de sala), rotina do mês, práticas EAD, guia rápido e envio de mensagens por WhatsApp.

O calendário mostra, em cada aula, o curso, a turma de ingresso (2026.1 ou 2026.2) e a sala (quando definida). As opções de sala são Sala 1, Sala 2, Sala 3, Sala 4, Sala 5 e Laboratório — as salas 1 a 3 normalmente têm aula de inglês, então use-as pro Semipresencial só quando estiverem livres naquele dia/horário (o sistema não sabe da agenda do inglês, então essa checagem é manual). Cada aula tem um checklist (chamada, fotos, vídeo) e a coordenação recebe lembrete, na véspera útil (pulando domingo), para perguntar ao professor se ele precisa de algo impresso ou separado. Dá para baixar o calendário do mês em PDF pelo botão "Baixar em PDF" (usa a função de imprimir do navegador; escolha "Salvar como PDF" na janela que abrir). Já o botão "Calendário do mês em PDF" na aba **Professores** gera um PDF diferente, específico daquele professor: uma lista com data, horário, disciplina, curso e sala de cada encontro do mês — em vez do calendário com bolinhas coloridas.

A aba **Buscar** procura por disciplina, curso, professor, sala, decisão pendente ou prática EAD ao mesmo tempo — digite e os resultados aparecem na hora.

Em **Conferência**, quando um aviso é uma exceção proposital (por exemplo: em dezembro, juntar os dois encontros de 3h30 num só de 7h para não bater sala/professor), clique em "Já revisei, não é erro" naquele item — ele some da lista (dá pra ver de novo marcando "Mostrar avisos já revisados"). Se os dados da aula mudarem de novo, o aviso volta a aparecer sozinho.

Em **Dados › Matrículas por turma** dá para importar a exportação de matrículas da sede (RA, Nome, Curso, Entrada, Turma) e acompanhar quantos alunos cada turma já tem, contando do jeito que a sede fecha o corte (Biomedicina+Farmácia, Terapia Ocupacional+Fisioterapia, Pedagogia+Psicopedagogia e Educação Física Lic.+Bach. juntos; os demais cursos sozinhos), por semestre de ingresso. Marque "Já formada" nas turmas que a sede já abriu e ajuste o corte mínimo (15, ou 10 quando for o caso) por turma.

Em **Dados**, no fim da página, fica o campo "Seu nome" e a lista **Atividade recente**: toda edição de aula, telefone, pendência ou matrícula fica registrada com quem mexeu e quando (ex.: "há 2 min · Carla · Editou aula: Bases Morfofuncionais · Sala 4"). Na primeira alteração que fizer, o painel pergunta seu nome uma vez (dá para trocar depois em Dados). Com a sincronização ativa, esse registro também aparece para as outras coordenadoras.

No menu, abaixo das abas, ficam dois atalhos que abrem em outra aba: **Permanência** (`permanencia.app.unifecaf.edu.br`) e **Links úteis** (`conteudo.unifecaf.com.br/polos-links-uteis`).

## Novas abas: Ocorrências, Estoque e Tarefas

Essas três abas substituem as planilhas que a coordenação usava separadamente. Os dados ficam salvos como tudo mais no painel (neste navegador, ou sincronizados entre navegadores se a sincronização estiver ativa).

- **Ocorrências**: registro de solicitações/problemas de alunos (aluno, RA, categoria, responsável, data, prazo, o que já foi feito). Mude o responsável direto na lista; quando marcar "Resolvido" a ocorrência sai da lista de abertas (dá para ver de novo marcando "Mostrar resolvidas").
- **Estoque**: itens de Escritório, Cozinha, Limpeza, Manutenção e Papelaria, agrupados por categoria, com quantidade, fornecedor, preço e a caixinha "Precisa comprar". Não faz comparação de preços entre fornecedores como a planilha antiga — é só um campo de observação/preço por item.
- **Tarefas**: lista contínua de demandas administrativas (data, responsável, prazo), com uma caixinha de concluída — não precisa mais recriar a lista todo mês copiando de uma planilha para a outra.

Essas três abas também entram na busca (aba **Buscar**).

## Pasta de evidências no Drive

Em **Professores** (para o mês atual) e ao abrir uma aula específica (nas abas Semana/Calendário), aparece um botão **Evidências** / **Pasta de evidências** que abre direto a pasta certa no Drive (`Evidencias_Aulas > Curso > Professor > mês_ano_semestre`), sem precisar navegar manualmente. As pastas de setembro e outubro de 2026 já foram criadas; para os meses seguintes, peça para as pastas serem criadas (ou peça isso aqui na conversa) — enquanto não existir uma pasta específica, o botão abre a pasta geral `Evidencias_Aulas` e é só criar a subpasta manualmente lá dentro, no mesmo padrão de nomes.

## Como publicar no GitHub Pages (uma vez só)

1. Entre em github.com e crie um repositório novo (ex.: `painel-polo-1740`).
2. Clique em **Add file › Upload files** e arraste **todo o conteúdo desta pasta** (index.html, app.js, logic.js, sync.js, sync-config.js, data.js, styles.css e a pasta vendor).
3. Clique em **Commit changes**.
4. Vá em **Settings › Pages**. Em *Branch*, escolha `main` e a pasta `/ (root)`. Salve.
5. Em 1 a 2 minutos o endereço aparece na mesma tela (algo como `https://seu-usuario.github.io/painel-polo-1740/`).

> Como o GitHub Pages da conta é público, qualquer pessoa com o link enxerga o data.js — inclusive os telefones dos professores. Compartilhe o link só com a equipe.

## Sincronizar entre navegadores (recomendado)

**Sem isso**, cada navegador guarda seu próprio rascunho: quando uma coordenadora edita algo em **Dados**, a mudança fica só no computador dela até alguém baixar o `data.js` e substituir o arquivo no GitHub — por isso hoje "a alteração que uma faz não aparece pras outras".

**Com a sincronização ativada**, qualquer alteração (calendário, telefones, pendências, práticas, status dos professores, rotina) aparece para todo mundo em poucos segundos, em qualquer navegador, sem baixar nem subir nada. É gratuito e não exige que as coordenadoras criem conta em lugar nenhum — só você faz esta configuração uma vez.

1. Acesse **console.firebase.google.com**, entre com uma conta Google e clique em **Adicionar projeto**. Dê um nome (ex.: `polo1740`) e conclua a criação (pode desligar o Google Analytics, não é necessário).
2. No painel do projeto, clique no ícone **`</>`** ("Web") para registrar um app da Web. Dê um apelido (ex.: `painel`) e clique em **Registrar app**. Não precisa configurar hospedagem.
3. O Firebase mostra um bloco `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. Copie **esse objeto inteiro**.
4. No menu lateral, vá em **Compilação › Firestore Database › Criar banco de dados**. Escolha um local (ex.: `southamerica-east1`) e comece em **modo de teste** (produção pede login, que as coordenadoras não têm).
5. Ainda no Firestore, na aba **Regras**, substitua o conteúdo por:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /polo1740/{doc} {
         allow read, write: if true;
       }
     }
   }
   ```
   e clique em **Publicar**. (Isso deixa o painel do polo aberto para quem tiver o link do site — igual ao que já acontece hoje com o data.js público.)
6. Abra o arquivo `sync-config.js` deste site e cole a configuração copiada no passo 3, assim:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "polo1740.firebaseapp.com",
     projectId: "polo1740",
     storageBucket: "polo1740.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
7. Suba o `sync-config.js` atualizado para o GitHub (substituindo o arquivo, como no passo de publicar). Pronto: da próxima vez que cada coordenadora abrir o site, o rodapé da tela vai mostrar "Sincronizado" e as mudanças passam a valer para todo mundo.

Se algum dia quiser desligar a sincronização, basta voltar o `sync-config.js` para `window.FIREBASE_CONFIG = null;` — o painel volta a funcionar como antes (rascunho local + publicar via data.js).

## Como atualizar o calendário

1. Abra o site › **Dados** › **Importar planilha** e escolha os Excel no mesmo modelo de sempre (agora com uma coluna opcional **Sala**).
2. Confira a aba **Conferência** (ela aponta datas erradas, choque de professor e choque ou falta de sala).
3. Ajuste o que precisar direto no site — cada aula tem um campo **Sala** (Sala 4, Sala 5 ou Laboratório) na tela de edição.
4. **Se a sincronização estiver ativa**: pronto, já vale para todo mundo.
   **Se não estiver**: em **Dados**, clique em **Baixar data.js para publicar** e, no GitHub, abra o repositório › clique em `data.js` › ícone de lápis › apague tudo e cole o novo conteúdo (ou use *Upload files* e substitua o arquivo). Commit.

## Primeiro uso da coordenadora

1. Abrir **Dados › Telefones** e colar a lista de professores (um por linha: `Nome (21) 99999-9999`). Salvar.
2. Ver a aba **Conferência** e resolver as pendências.
3. Usar **Rotina do mês** como checklist dos prazos.
