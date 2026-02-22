import { LedMatrix } from '../src';
import { matrixOptions, runtimeOptions } from './_config';
import Jimp from 'jimp';

export function removeAlpha(array: Uint8ClampedArray) {
	const result = [];

	for (let i = 0; i < array.length; i++) {
		if ((i + 1) % 4 === 0) {
			continue;
		}
		result.push(array[i]);
	}

	return Buffer.from(result);
}

export function prepareImageForMatrix(jimp: Jimp) {
	const resized = jimp.resize(32, 64);
	const colorArray = new Uint8Array(resized.colorType(0).bitmap.data.buffer);

	const nonAlphaImage = removeAlpha(Uint8ClampedArray.from(colorArray));
	return nonAlphaImage;
}

async function resizeImage(data: Buffer) {
	console.log('Reading an image file to Jimp');
	const jimp = await Jimp.read(data);
	console.log('Creating a non-transparent bitmap');
	const nonAlphaImage = prepareImageForMatrix(jimp);
	console.log('Drawing the new image');
	
	return nonAlphaImage;
}

const weather = async()=>{

		const matrix = new LedMatrix(matrixOptions, runtimeOptions);
	
		const jimp = await Jimp.read('https://cdn-icons-png.flaticon.com/512/169/169367.png');
		const buffer = await jimp.getBufferAsync(Jimp.MIME_PNG);
		const data = await resizeImage(buffer);
		matrix.clear().brightness(100).drawBuffer(data).sync();

		matrix.sync();

}

weather();
