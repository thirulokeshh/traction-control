const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Path to the generated high-res image
const srcImage = 'C:\\Users\\Thiru\\.gemini\\antigravity-ide\\brain\\3846d6f7-d33d-475e-af65-9f0da068da93\\traction_control_icon_1784310122920.png';

// PowerShell command to resize the image using .NET System.Drawing
const psCommand = `
Add-Type -AssemblyName System.Drawing
$srcImg = [System.Drawing.Image]::FromFile('${srcImage.replace(/\\/g, '\\\\')}')
$sizes = @(16, 48, 128)
foreach ($size in $sizes) {
    $destImg = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($destImg)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($srcImg, 0, 0, $size, $size)
    $graphics.Dispose()
    $destPath = "${iconsDir.replace(/\\/g, '\\\\')}\\icon$size.png"
    $destImg.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destImg.Dispose()
}
$srcImg.Dispose()
Write-Host "Icons successfully generated in ${iconsDir.replace(/\\/g, '\\\\')}"
`;

// Run the powershell command
const child = exec(`powershell -Command "${psCommand.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error generating icons: ${error.message}`);
    process.exit(1);
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  console.log(stdout);
});
