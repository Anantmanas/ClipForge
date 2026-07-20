import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)

interface BrandingOptions {
    mainClip: string
    introPath: string | null
    outroPath: string | null
    outputPath: string
}

export async function stitchBranding(opts: BrandingOptions): Promise<void> {
    const { mainClip, introPath, outroPath, outputPath } = opts
    const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg'

    const parts: string[] = []
    if (introPath && fs.existsSync(introPath)) parts.push(introPath)
    parts.push(mainClip)
    if (outroPath && fs.existsSync(outroPath)) parts.push(outroPath)

    if (parts.length === 1) {
        // No branding files found, just copy
        fs.copyFileSync(mainClip, outputPath)
        return
    }

    // Write a concat list file for FFmpeg
    const listPath = path.join(path.dirname(outputPath), `concat_${Date.now()}.txt`)
    const listContent = parts.map(p => `file '${path.resolve(p)}'`).join('\n')
    fs.writeFileSync(listPath, listContent)

    try {
        await execFileAsync(ffmpeg, [
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c:v', 'libx264',   // re-encode so all segments match
            '-c:a', 'aac',
            '-movflags', '+faststart',
            '-y',
            outputPath,
        ])
    } finally {
        fs.unlinkSync(listPath)  // cleanup
    }
}