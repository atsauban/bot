import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractText } from '../src/platform/wa/extract.js';

describe('extractText', () => {
  it('reads conversation', () => {
    const text = extractText({ message: { conversation: '  !ping  ' } });
    assert.equal(text, '!ping');
  });
  it('reads extendedTextMessage', () => {
    const text = extractText({ message: { extendedTextMessage: { text: 'hi' } } });
    assert.equal(text, 'hi');
  });
  it('reads image caption', () => {
    const text = extractText({ message: { imageMessage: { caption: '!weather jakarta' } } });
    assert.equal(text, '!weather jakarta');
  });
  it('reads buttons selectedButtonId', () => {
    const text = extractText({ message: { buttonsResponseMessage: { selectedButtonId: '!1' } } });
    assert.equal(text, '!1');
  });
  it('maps buttons selectedDisplayText numeric to !n', () => {
    const text = extractText({
      message: { buttonsResponseMessage: { selectedDisplayText: '  3 ' } },
    });
    assert.equal(text, '!3');
  });
  it('reads list selectedRowId', () => {
    const text = extractText({
      message: { listResponseMessage: { singleSelectReply: { selectedRowId: '!help' } } },
    });
    assert.equal(text, '!help');
  });
  it('reads template button selectedId', () => {
    const text = extractText({ message: { templateButtonReplyMessage: { selectedId: '!2' } } });
    assert.equal(text, '!2');
  });
  it('reads interactive nativeFlow paramsJson', () => {
    const text = extractText({
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: '!ok' }) },
        },
      },
    });
    assert.equal(text, '!ok');
  });
});
