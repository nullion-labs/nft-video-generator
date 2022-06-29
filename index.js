const fs = require("fs");
var path = require("path");
const { exec } = require("child_process");

const verbose = false; // set to true if you wanna see fmpeg logs

const destinationFolder = "./export"; // destination folder where to store exports
const resultPrefix = "result-"; // result prefix (default: result-) 0.mp4 will be appended to it
const bitRate = 30; // ffmpeg libx264 constant rate 0-50 (0 being as original)

let resultNumber = 0; // result counter
const layerFolders = {}; // map to find folders where each item is stored

// create destination folder if it doesnt exist
if (!fs.existsSync(destinationFolder)) {
  fs.mkdirSync(destinationFolder);
}

async function init() {
  // used to store each layer as new array
  const layersArray = [];

  // get all folders inside layers folder
  let layersFolder = fs.readdirSync("layers");

  // reverse or sort by descending order z to a
  layersFolder = layersFolder.reverse();

  // go through each folder inside layers and assign its files to array
  layersFolder.forEach((layerFolderName) => {
    const layerFiles = fs.readdirSync(`layers/${layerFolderName}`);
    layerFiles.forEach((x) => {
      layerFolders[x] = layerFolderName;
    });
    layersArray.push(layerFiles);
  });

  // combine all possible combinations
  const combinedLayers = combineArraysRecursively(layersArray);

  // for each combination do ffmpeg process and save exported video as mp4
  for (let i = 0; i < combinedLayers.length; i++) {
    await process(combinedLayers[i]);
  }
}
init();

// where magic happens
async function process(layers) {
  let paths = "";
  let filters = "";
  layers.forEach((layer, key) => {
    let path = `${__dirname}\\layers\\${layerFolders[layer]}\\${layer}`;
    paths += ` -i "${path}"`;
    filters += `[${key}:v]alphaextract[ae${key}];[${key}][ae${key}]alphamerge[alm${key}];[alm${key}]scale=2000:-2[s${key}];`;
  });

  for (let i = layers.length - 1; i > 0; i--) {
    if (i === layers.length - 1) {
      filters += `[s${i - 1}][s${i}]overlay[o${i}-${i - 1}];`;
    } else if (i === 1) {
      filters += `[s${i - 1}][o${i + 1}-${i}]overlay`;
    } else {
      filters += `[s${i - 1}][o${i + 1}-${i}]overlay[o${i}-${i - 1}];`;
    }
  }
  await new Promise((resolve, reject) => {
    console.log(`executing video #${resultNumber}`);
    const ffmpeg = exec(
      `ffmpeg${paths} -filter_complex "${filters}" -c:v libx264 -crf ${bitRate} -shortest -y "${destinationFolder}/${resultPrefix}${resultNumber++}.mp4"`
    );
    ffmpeg.stderr.on("data", function (data) {
      if (verbose) {
        console.log("[ffmpeg]:", data);
      }
    });
    ffmpeg.on("close", (code) => {
      if (verbose) {
        console.log("[ffmpeg]: closed with code:" + code);
      }
      if (code == 1) {
        reject();
      } else {
        console.log(`finished video #${resultNumber}`);
        resolve();
      }
    });
  });
}
function combineArraysRecursively(array_of_arrays) {
  if (!array_of_arrays) {
    return [];
  }
  if (!Array.isArray(array_of_arrays)) {
    return [];
  }
  if (array_of_arrays.length == 0) {
    return [];
  }

  for (let i = 0; i < array_of_arrays.length; i++) {
    if (!Array.isArray(array_of_arrays[i]) || array_of_arrays[i].length == 0) {
      return [];
    }
  }
  let outputs = [];
  function permute(arrayOfArrays, whichArray = 0, output = "") {
    arrayOfArrays[whichArray].forEach((array_element) => {
      if (whichArray == array_of_arrays.length - 1) {
        outputs.push((output + array_element).split("---|---"));
      } else {
        permute(
          arrayOfArrays,
          whichArray + 1,
          output + array_element + "---|---"
        );
      }
    });
  }
  permute(array_of_arrays);
  return outputs;
}
