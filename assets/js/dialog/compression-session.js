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
 * Compression runs for one dialog's batch of images.
 *
 * Previews re-run whenever the settings change; a run counter discards results
 * from runs that finish after a newer one has started.
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
        const outcomes = await this.compressAll(options)

        return run === this.#run ? outcomes : null
    }

    /** Discard any preview still running. */
    cancel() {
        this.#run++
    }

    /**
     * @param {import('media-compressor/config').CompressionOptions} options
     * @returns {Promise<Outcome[]>}
     */
    async compressAll(options) {
        const settled = await Promise.allSettled(
            this.#files.map((file) => this.#compressor.compress(file, options)),
        )

        return settled.map((result, index) =>
            CompressionSession.#toOutcome(result, this.#files[index]),
        )
    }

    /**
     * @param {PromiseSettledResult<File>} result
     * @param {File} original
     * @returns {Outcome}
     */
    static #toOutcome(result, original) {
        if (result.status === 'rejected') {
            return new Outcome(original, original, result.reason)
        }

        // Never upload something bigger than what we started with.
        return result.value.size < original.size
            ? new Outcome(original, result.value)
            : new Outcome(original)
    }
}
