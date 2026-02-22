import {
  LedMatrix,
} from '../src';
import { matrixOptions, runtimeOptions } from './_config';

// enum Colors {
//   black = 0x000000,
//   red = 0xff0000,
//   green = 0x00ff00,
//   blue = 0x0000ff,
//   magenta = 0xff00ff,
//   cyan = 0x00ffff,
//   yellow = 0xffff00,
// }



const wait = (t: number) => new Promise(ok => setTimeout(ok, t));


(async () => {
  try {
    const matrix = new LedMatrix(matrixOptions, runtimeOptions);

    // RGB fills
    const interval = 2000;
    while(true){

      matrix.fgColor(0xff00ff).fill().sync();
      // await wait(interval);
      // matrix.fgColor(Colors.blue).fill().sync();
      // await wait(interval);
      // matrix.fgColor(Colors.green).fill().sync();
      // await wait(interval);
      // matrix.clear();
      await wait(interval);
    }
   
  } catch (error) {
    console.error(error);
  }
})();
