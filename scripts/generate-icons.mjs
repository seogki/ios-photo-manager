import fs from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const root = process.cwd();
const svgPath = path.join(root, "build", "app-icon.svg");
const pngPath = path.join(root, "build", "icon.png");
const png512Path = path.join(root, "build", "512x512.png");
const rootPng512Path = path.join(root, "512x512.png");
const icoPath = path.join(root, "build", "icon.ico");
const publicPngPath = path.join(root, "public", "app-icon.png");

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const svg = await fs.readFile(svgPath);

const renderPng = (size) => {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: size,
    },
  });
  return resvg.render().asPng();
};

const png1024 = renderPng(1024);
const png512 = renderPng(512);
await fs.writeFile(pngPath, png1024);
await fs.writeFile(png512Path, png512);
await fs.writeFile(rootPng512Path, png512);
await fs.writeFile(publicPngPath, png1024);

const icoInputs = icoSizes.map((size) => renderPng(size));
const icoData = await pngToIco(icoInputs);
await fs.writeFile(icoPath, icoData);

console.log("Generated:", path.relative(root, pngPath));
console.log("Generated:", path.relative(root, png512Path));
console.log("Generated:", path.relative(root, rootPng512Path));
console.log("Generated:", path.relative(root, icoPath), `(sizes: ${icoSizes.join(", ")})`);
console.log("Generated:", path.relative(root, publicPngPath));
