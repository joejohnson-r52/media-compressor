/**
 * The result of compressing one image: which file will be uploaded, and why.
 */
export class Outcome {
    /**
     * @param {File} original
     * @param {File} [file] - the file to upload; the original unless compression made it smaller
     * @param {Error|null} [error] - why compression failed, if it did
     */
    constructor(original, file = original, error = null) {
        this.original = original
        this.file = file
        this.error = error
        Object.freeze(this)
    }

    /** Whether the compressed version will be uploaded. */
    get compressed() {
        return this.file !== this.original
    }

    /** Size reduction, as a whole percentage. */
    get saving() {
        return Math.round((1 - this.file.size / this.original.size) * 100)
    }
}

/**
 * How many images are compressed at once. Each holds its full-size decoded
 * pixels (about 48 MB for a 12 MP photo) until drawn, so a whole batch at once
 * can exhaust the browser's memory, notably Safari's canvas limit.
 */
const CONCURRENCY = 2

/**
 * Compression runs for one dialog's batch of images.
 *
 * Previews re-run whenever the settings change; a run counter discards results
 * from runs that finish after a newer one has started, and stops them starting
 * any more images.
 */
export class CompressionSession {
    #files
    #compressor
    #run = 0

    /**
     * @param {File[]} files
     * @param {{compress: (file: File, options: object) => Promise<File>}} compressor
     */
    constructor(files, compressor) {
        this.#files = files
        this.#compressor = compressor
    }

    /**
     * @param {import('media-compressor/config').CompressionOptions} options
     * @returns {Promise<Outcome[]|null>} null if a newer run started meanwhile
     */
    async preview(options) {
        const run = ++this.#run
        const outcomes = await this.compressAll(
            options,
            () => run !== this.#run,
        )

        return run === this.#run ? outcomes : null
    }

    /** Discard any preview still running. */
    cancel() {
        this.#run++
    }

    /**
     * Compress every image, CONCURRENCY at a time.
     *
     * @param {import('media-compressor/config').CompressionOptions} options
     * @param {() => boolean} [isStale] - true once the results are unwanted;
     *     no further images are started, and the outcomes are incomplete
     * @returns {Promise<Outcome[]>}
     */
    async compressAll(options, isStale = () => false) {
        const outcomes = []
        let next = 0

        const worker = async () => {
            while (next < this.#files.length && !isStale()) {
                const index = next++

                outcomes[index] = await this.#compress(
                    this.#files[index],
                    options,
                )
            }
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, worker))

        return outcomes
    }

    /**
     * @param {File} original
     * @param {import('media-compressor/config').CompressionOptions} options
     * @returns {Promise<Outcome>}
     */
    async #compress(original, options) {
        let file

        try {
            file = await this.#compressor.compress(original, options)
        } catch (error) {
            return new Outcome(original, original, error)
        }

        // Never upload something bigger than what we started with.
        return file.size < original.size
            ? new Outcome(original, file)
            : new Outcome(original)
    }
}
