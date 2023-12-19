let CONFIG = {
  base_url: "https://api.openai.com/v1/chat/completions",
  chat_gpt_api_key:"sk-...",
  model:"gpt-4-1106-preview",
  role: "Sei ein Spezialist für Suchmaschinenwerbung.",
  task:"\nAufgabe: Schreibe einen Kurztitel mit maximal 25 Zeichen. Verzichte auf Größenangaben. Antworte mit einem Kurztitel. Antworte nur mit dem Wert.",
  examples:"Beispiele:\n" +
        "Titel: Sora Choi Chione Bracelet: Sterling Silber - Armbänder Nachhaltig: Fairtrade, Handgemacht, Swiss\n" +
        "Kurztitel: Made	Sora Choi - Bracelet\n" + 
        "Titel:Dirty Velvet 'Paradise Lost' T-Shirt Weiß Größe S Fair Trade Bio-Baumwolle" + 
        "\nKurztitel:	Dirty Velvet T-Shirt" +
        "\n Titel: Hervorragend 3D Pop-up Karte Mountainbike orange - Grusskarte Nachhaltig: Fairtrade, Handgemacht, Spendenanteil" +
        "\nKurztitel: 3D Grußkarte" +
        "\nTitel: ",
  correction_message: "Der letzte Titel war zu lang. Versuche es mit anderen Begriffen. Kontrolliere ob der Wert nicht zu lang wird. Stelle sicher, dass die Antwort nur der Wert von 'Kurztitel' ist."
}

function rewriteTitle() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("List")
  const products = sh.getDataRange().getValues().map((v,i)=>({index:i+1, name:v[1], rewrite:v[2]})).filter(i=> i.index!=1 && i.rewrite=="")
  for (let {index, name} of products){
    promt = CONFIG.task  + CONFIG.examples + '"' + name + '"'
    var short_title = processTitle(promt)
    sh.getRange(index,3,1,1).setValue(short_title)
  }
}

let lastCompletionId = null; // Globale Variable, um die letzte completion.id zu speichern

function getGpt(userContent, num, modifyPrevious = false) {

  const systemContent = CONFIG.role;
  try {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CONFIG.chat_gpt_api_key}`
    };

    let requestBody = {
      "model": CONFIG.model,
      "messages": [{
        "role": "system",
        "content": systemContent,
      },
      {
        "role": "user",
        "content": userContent
      }],
      "temperature": 0.7
    };

    if (modifyPrevious && lastCompletionId) {

      requestBody.completion = lastCompletionId; // Verwenden der letzten completion.id
      let requestBody = {
        "model": CONFIG.model,
        "messages": [
        {
          "role": "user",
          "content": correction_message
        }],
        "temperature": 0.7
      };
      Logger.log(requestBody)
    }

    const options = {
      headers,
      method: "POST", // Verwendung von POST für Anfragen
      muteHttpExceptions: true,
      payload: JSON.stringify(requestBody)
    };

    const response = JSON.parse(UrlFetchApp.fetch(CONFIG.base_url, options));
    if(modifyPrevious){
      Logger.log(response)
    }
    lastCompletionId = response.choices[0].id; // Speichern der aktuellen completion.id
    return response.choices[0].message.content.replaceAll('"', "").replaceAll('!', "").replaceAll('?', "");
  } catch (e) {
    console.log(e);
    return "Some Error Occured Please check your formula or try again later.";
  }
}

function processTitle(name) {
  const MAX_TRIES = 5;
  const MAX_LENGTH = 25;
  let tries = 0;
  let result = "";
  let count = 19;

  do {
    result = getGpt(name, count, tries > 0); 
    let lengthDifference = result.length - MAX_LENGTH;
    if (lengthDifference > 0) {
      count = count - lengthDifference;
    }
    tries++;
  } while (result.length > MAX_LENGTH && tries < MAX_TRIES);
  if(result.length > MAX_LENGTH){
    Logger.log("Unable to construct Title in Proper Length:\n" + name + "\n\nResult:\n" + result)
  }
  return result.length > MAX_LENGTH ? null : result;
}


function onOpen(){
  SpreadsheetApp.getUi().createMenu("Script")
  .addItem("Rewrite titles", "rewriteTitle")
  .addToUi()
}
