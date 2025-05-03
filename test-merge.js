// Test script to merge audio files using FFmpeg
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import os from 'os';

async function downloadFile(url, outputPath) {
  console.log(`Downloading ${url} to ${outputPath}`);
  const writer = fs.createWriteStream(outputPath);
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: {
      'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
    }
  });
  
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log(`Downloaded ${url} successfully`);
      resolve();
    });
    writer.on('error', reject);
  });
}

async function mergeAudioFiles(urls) {
  // Create temporary directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-test-'));
  console.log(`Created temporary directory: ${tempDir}`);
  
  try {
    // Download all files
    const filePaths = [];
    for (let i = 0; i < urls.length; i++) {
      const filePath = path.join(tempDir, `chunk-${i}.mp3`);
      await downloadFile(urls[i], filePath);
      filePaths.push(filePath);
    }
    
    // Create a file list for FFmpeg
    const fileListPath = path.join(tempDir, 'filelist.txt');
    const fileListContent = filePaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(fileListPath, fileListContent);
    
    console.log(`Created FFmpeg file list at ${fileListPath}:`);
    console.log(fileListContent);
    
    // Output path for the merged file
    const mergedFilePath = path.join(tempDir, 'merged.mp3');
    
    // Instead of using the concat demuxer with -c copy (which requires identical codecs),
    // we'll use FFmpeg to convert and properly merge the files
    // This approach is more reliable with potentially different audio formats
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -ar 44100 -ac 2 -b:a 192k "${mergedFilePath}"`;
    console.log(`Executing FFmpeg command: ${ffmpegCommand}`);
    
    execSync(ffmpegCommand, { stdio: 'inherit' });
    
    console.log(`FFmpeg successfully merged files to ${mergedFilePath}`);
    
    // Copy the result to the current directory for easy access
    const outputPath = './merged-output.mp3';
    fs.copyFileSync(mergedFilePath, outputPath);
    console.log(`Copied merged file to ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error(`Error during FFmpeg processing:`, error);
    throw error;
  } finally {
    // Cleanup temp directory
    try {
      fs.rmdirSync(tempDir, { recursive: true });
      console.log(`Cleaned up temporary directory: ${tempDir}`);
    } catch (cleanupError) {
      console.error(`Error cleaning up temp directory: ${cleanupError}`);
    }
  }
}

// Audio URLs for podcast ID 13
const audioUrls = [
  "https://storage.googleapis.com/hanno-5c0a7.appspot.com/c765fc72-7781-492d-a978-d4501eda6055.mp3",
  "https://storage.googleapis.com/hanno-5c0a7.appspot.com/ea335ae5-b4f5-4261-9aeb-5f5b6bfb32b2.mp3"
];

// Run the merge
mergeAudioFiles(audioUrls)
  .then(outputPath => {
    console.log(`Merge completed successfully. Output file: ${outputPath}`);
    
    // Get file size
    const stats = fs.statSync(outputPath);
    console.log(`Merged file size: ${stats.size} bytes`);
  })
  .catch(error => {
    console.error('Failed to merge audio files:', error);
    process.exit(1);
  });