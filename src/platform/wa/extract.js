// Ekstrak teks dari berbagai tipe pesan Baileys
export function extractText(message) {
  const msg = message.message;
  if (!msg) return '';

  if (msg.conversation) return msg.conversation.trim();
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text.trim();
  if (msg.imageMessage?.caption) return msg.imageMessage.caption.trim();
  if (msg.videoMessage?.caption) return msg.videoMessage.caption.trim();
  if (msg.buttonsResponseMessage?.selectedButtonId) {
    return msg.buttonsResponseMessage.selectedButtonId.trim();
  }
  if (msg.buttonsResponseMessage?.selectedDisplayText) {
    const disp = msg.buttonsResponseMessage.selectedDisplayText.trim();
    if (/^\d+$/.test(disp)) return `!${disp}`;
    return disp;
  }
  if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return msg.listResponseMessage.singleSelectReply.selectedRowId.trim();
  }
  if (msg.templateButtonReplyMessage?.selectedId) {
    return msg.templateButtonReplyMessage.selectedId.trim();
  }
  if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const params = JSON.parse(
        msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson,
      );
      return params.id?.trim() ?? '';
    } catch {
      return '';
    }
  }

  return '';
}

export default extractText;
