// Test file: test-canvas.js
const { createCanvas } = require('canvas');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

ctx.fillStyle = 'green';
ctx.fillRect(10, 10, 150, 100);

console.log('Canvas works! Buffer length:', canvas.toBuffer().length);