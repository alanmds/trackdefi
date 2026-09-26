/**
 * trackdefi — entrega do formulário de feedback no Gmail do dono.
 *
 * É a OUTRA METADE da rota `app/api/feedback/route.ts`. Roda no Google Apps
 * Script, dentro da conta Google do Alan — nenhuma conta nova, nenhuma senha
 * guardada em lugar nenhum.
 *
 * Por que é seguro deixar a URL deste script na Vercel: ele só sabe fazer UMA
 * coisa — mandar um e-mail para o PRÓPRIO dono. O destinatário não vem de
 * fora, então ninguém consegue usá-lo para mandar e-mail a terceiros; e ele não
 * lê a caixa de ninguém. Se a URL vazar, o pior caso é o Alan receber lixo
 * (limitado pelo Google a 100 e-mails por dia).
 *
 * INSTALAR (uma vez, ~5 minutos):
 *  1. script.google.com → "Novo projeto" (logado na conta do Gmail de destino)
 *  2. apagar o conteúdo que vem pronto e colar ESTE arquivo inteiro
 *  3. Implantar → Nova implantação → tipo "App da Web"
 *       Executar como: Eu
 *       Quem pode acessar: Qualquer pessoa
 *  4. autorizar (o Google pede permissão para "enviar e-mail como você")
 *  5. copiar a "URL do app da Web" (termina em /exec) e colar na Vercel como
 *     FEEDBACK_WEBHOOK_URL, marcada como Sensitive
 */

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("bad request");
  }

  var subject = String(d.subject || "[trackdefi feedback]").slice(0, 200);
  var body = String(d.text || "").slice(0, 20000);
  var replyTo = String(d.replyTo || "");

  var msg = {
    // o próprio dono do script: o endereço nunca sai da conta Google
    to: Session.getEffectiveUser().getEmail(),
    subject: subject,
    body: body,
    name: "trackdefi feedback",
  };
  // quando o visitante deixou e-mail, "Responder" vai direto para ele
  if (replyTo.indexOf("@") > 0) msg.replyTo = replyTo;

  MailApp.sendEmail(msg);
  return ContentService.createTextOutput("ok");
}
