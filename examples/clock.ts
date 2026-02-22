import {
  LedMatrix,
  Font,
  LayoutUtils,
  HorizontalAlignment,
  VerticalAlignment,
} from '../src';
import { matrixOptions, runtimeOptions } from './_config';

const wait = (t: number) => new Promise(ok => setTimeout(ok, t));

(async () => {
  const matrix = new LedMatrix(matrixOptions, runtimeOptions);

  // Text positions
  const font = new Font('helvR12', `${process.cwd()}/fonts/IBMPlexMono-Medium-24_jep.bdf`);
  matrix.font(font);
  matrix.fgColor(0xffffff)
  

  while (true) {
    matrix.clear()
    const now = new Date()
    const currentHour = now.getHours() < 10 ? '0' + now.getHours() : now.getHours()
    console.log('currentHour: ', currentHour);
    const currentMinute = now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()
    const currentSeconds = now.getSeconds()
    const colon = currentSeconds % 2 === 1 ? ":" : " "
    console.log('currentMinute: ', currentMinute);
    const lines = LayoutUtils.textToLines(
      font,
      matrix.width(),
      `${currentHour}${colon}${currentMinute}`
    );

    LayoutUtils.linesToMappedGlyphs(
      lines,
      font.height(),
      matrix.width(),
      matrix.height(),
      HorizontalAlignment.Center,
      VerticalAlignment.Middle,
    ).map(glyph => {
      matrix.drawText(glyph.char, glyph.x, glyph.y);
    });
    matrix.sync();
    await wait(1000);
  }
})();
