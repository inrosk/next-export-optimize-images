import * as https from 'https'
import path from 'path'

import fs from 'fs-extra'

import type { Manifest } from '../'

type ExternalImagesDownloaderArgs = {
  terse?: boolean
  manifest: Manifest
  destDir: string
}

async function downloadImage(externalUrl: string, fileName: string, destDir: string, terse: boolean) {
  const outputPath = path.join(destDir, fileName)

  return new Promise<void>((resolve, reject) => {
    https.get(externalUrl, (response) => {
      if (response.statusCode !== 200) {
        console.error(`Error: Unable to download ${externalUrl} (status code: ${response.statusCode}).`)
        reject(new Error(`Status code: ${response.statusCode}`))
        return
      }

      fs.ensureFile(outputPath, (err) => {
        if (err) {
          console.error(`Error: Unable to write to ${outputPath} (${err.message}).`)

          reject(err)
          return
        }

        response
          .pipe(fs.createWriteStream(outputPath))
          .on('error', (error) => {
            console.error(`\`${externalUrl}\` failed to download.`)

            reject(error)
          })
          .on('close', () => {
            fs.stat(outputPath, (err, stats) => {
              if (err) {
                console.error(`Error: Unable to get the size of ${externalUrl} (${err.message}).`)

                reject(err)
                return
              }

              if (stats.size === 0) {
                console.error(`Error: Unable to save ${externalUrl} (empty file).`)

                reject(new Error('Empty file'))
                return
              }
            })

            if (!terse) {
              // eslint-disable-next-line no-console
              console.log(`\`${externalUrl}\` has been downloaded.`)
            }

            resolve(undefined)
          })
      })
    })
  })
}

const externalImagesDownloader = async ({ terse = false, manifest, destDir }: ExternalImagesDownloaderArgs) => {
  if (!terse) {
    // eslint-disable-next-line no-console
    console.log('\n- Download external images -')
  }

  const images: Manifest = []

  manifest.forEach((el) => {
    if (el.externalUrl && !images.some((prev) => prev.externalUrl === el.externalUrl)) {
      images.push(el)
    }
  })

  const batchSize = 20
  const batches = Math.ceil(images.length / batchSize) // determine the number of batches

  for (let i = 0; i < batches; i++) {
    // eslint-disable-next-line no-console
    console.log(`Batch ${i} started`)

    const start = i * batchSize // calculate the start index of the batch
    const end = Math.min(images.length, start + batchSize) // calculate the end index of the batch
    const batchImages = images.slice(start, end)

    const promises = batchImages.map((el) => downloadImage(el.externalUrl as string, el.src, destDir, terse))

    try {
      await Promise.all(promises)

      // eslint-disable-next-line no-console
      console.log(`Batch ${i} finished`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error(`Error: Unable to download remote images (${e.message}).`)
      throw e
    }
  }
}

export default externalImagesDownloader
