/**
 * TUS Resumable Upload Client
 * Implements TUS protocol for resumable file uploads with progress tracking
 */
class TusUploader {
    constructor(options = {}) {
        this.endpoint = options.endpoint || '/tus';
        this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB chunks
        this.retryDelays = options.retryDelays || [0, 1000, 3000, 5000];
        this.onProgress = options.onProgress || (() => {});
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || (() => {});
        this.headers = options.headers || {};
    }

    /**
     * Upload a file with TUS protocol
     * @param {File} file - The file to upload
     * @param {Object} metadata - Additional metadata (folderId, etc.)
     * @returns {Promise} - Resolves when upload completes
     */
    async upload(file, metadata = {}) {
        const upload = {
            file,
            metadata,
            uploadUrl: null,
            offset: 0,
            retryAttempt: 0,
            aborted: false
        };

        try {
            // Step 1: Create upload
            upload.uploadUrl = await this.createUpload(file, metadata);

            // Step 2: Upload chunks
            await this.uploadChunks(upload);

            this.onSuccess(file, upload);
            return upload;
        } catch (error) {
            if (!upload.aborted) {
                this.onError(error, file, upload);
            }
            throw error;
        }
    }

    /**
     * Resume an existing upload
     * @param {File} file - The file to upload
     * @param {string} uploadUrl - The TUS upload URL
     * @returns {Promise}
     */
    async resume(file, uploadUrl) {
        const upload = {
            file,
            metadata: {},
            uploadUrl,
            offset: 0,
            retryAttempt: 0,
            aborted: false
        };

        try {
            // Get current offset
            upload.offset = await this.getOffset(uploadUrl);

            // Continue uploading
            await this.uploadChunks(upload);

            this.onSuccess(file, upload);
            return upload;
        } catch (error) {
            if (!upload.aborted) {
                this.onError(error, file, upload);
            }
            throw error;
        }
    }

    /**
     * Create a new upload on the server
     */
    async createUpload(file, metadata) {
        const metadataHeader = this.encodeMetadata({
            filename: file.name,
            filetype: file.type,
            ...metadata
        });

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Tus-Resumable': '1.0.0',
                'Upload-Length': file.size,
                'Upload-Metadata': metadataHeader,
                ...this.headers
            }
        });

        if (response.status !== 201) {
            const error = await response.text();
            throw new Error(`Failed to create upload: ${error}`);
        }

        return response.headers.get('Location');
    }

    /**
     * Get current upload offset from server
     */
    async getOffset(uploadUrl) {
        const response = await fetch(uploadUrl, {
            method: 'HEAD',
            headers: {
                'Tus-Resumable': '1.0.0',
                ...this.headers
            }
        });

        if (response.status === 404) {
            throw new Error('Upload not found. It may have expired.');
        }

        if (!response.ok) {
            throw new Error('Failed to get upload status');
        }

        return parseInt(response.headers.get('Upload-Offset') || '0', 10);
    }

    /**
     * Upload file in chunks
     */
    async uploadChunks(upload) {
        const { file, uploadUrl } = upload;

        while (upload.offset < file.size && !upload.aborted) {
            const chunk = file.slice(upload.offset, upload.offset + this.chunkSize);

            try {
                await this.uploadChunk(upload, chunk);
                upload.retryAttempt = 0; // Reset retry counter on success
            } catch (error) {
                if (upload.aborted) return;

                // Retry logic
                if (upload.retryAttempt < this.retryDelays.length) {
                    const delay = this.retryDelays[upload.retryAttempt];
                    upload.retryAttempt++;

                    console.log(`Upload failed, retrying in ${delay}ms (attempt ${upload.retryAttempt})`);
                    await this.sleep(delay);

                    // Get current offset before retry
                    try {
                        upload.offset = await this.getOffset(uploadUrl);
                    } catch (e) {
                        throw error; // Original error if we can't get offset
                    }
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Upload a single chunk
     */
    async uploadChunk(upload, chunk) {
        const { file, uploadUrl, offset } = upload;

        const response = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
                'Tus-Resumable': '1.0.0',
                'Upload-Offset': offset,
                'Content-Type': 'application/offset+octet-stream',
                ...this.headers
            },
            body: chunk
        });

        if (response.status === 409) {
            // Offset mismatch - get correct offset and retry
            upload.offset = await this.getOffset(uploadUrl);
            throw new Error('Offset mismatch');
        }

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Chunk upload failed: ${error}`);
        }

        const newOffset = parseInt(response.headers.get('Upload-Offset') || '0', 10);
        upload.offset = newOffset;

        // Report progress
        const progress = (newOffset / file.size) * 100;
        this.onProgress(progress, newOffset, file.size, file);
    }

    /**
     * Cancel an upload
     */
    async cancel(uploadUrl) {
        try {
            await fetch(uploadUrl, {
                method: 'DELETE',
                headers: {
                    'Tus-Resumable': '1.0.0',
                    ...this.headers
                }
            });
        } catch (e) {
            console.warn('Failed to cancel upload:', e);
        }
    }

    /**
     * Encode metadata for TUS header
     */
    encodeMetadata(metadata) {
        return Object.entries(metadata)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${key} ${btoa(String(value))}`)
            .join(',');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * File Upload Manager with TUS support and fallback
 * Integrates with existing upload UI
 */
class FileUploadManager {
    constructor(options = {}) {
        this.useTus = options.useTus !== false;
        this.tusThreshold = options.tusThreshold || 10 * 1024 * 1024; // Use TUS for files > 10MB
        this.folderId = options.folderId || null;
        this.uploadEndpoint = options.uploadEndpoint || '/Files/UploadFile';
        this.tusEndpoint = options.tusEndpoint || '/tus';
        this.antiForgeryToken = options.antiForgeryToken || this.getAntiForgeryToken();

        this.uploads = new Map(); // Track active uploads
        this.onProgress = options.onProgress || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
        this.onAllComplete = options.onAllComplete || (() => {});
    }

    /**
     * Upload multiple files
     */
    async uploadFiles(files) {
        const results = [];
        let completed = 0;

        for (const file of files) {
            try {
                const result = await this.uploadFile(file);
                results.push({ file, success: true, result });
            } catch (error) {
                results.push({ file, success: false, error });
            }

            completed++;
            if (completed === files.length) {
                this.onAllComplete(results);
            }
        }

        return results;
    }

    /**
     * Upload a single file (auto-selects TUS or standard based on size)
     */
    async uploadFile(file) {
        // Use TUS for large files
        if (this.useTus && file.size > this.tusThreshold) {
            return this.uploadWithTus(file);
        }
        return this.uploadStandard(file);
    }

    /**
     * Upload using TUS protocol (resumable)
     */
    async uploadWithTus(file) {
        const uploadId = this.generateId();

        const uploader = new TusUploader({
            endpoint: this.tusEndpoint,
            headers: {
                'RequestVerificationToken': this.antiForgeryToken
            },
            onProgress: (progress, uploaded, total) => {
                this.onProgress(file, progress, uploaded, total, uploadId);
            },
            onSuccess: () => {
                this.uploads.delete(uploadId);
                this.onComplete(file, uploadId);
            },
            onError: (error) => {
                this.uploads.delete(uploadId);
                this.onError(file, error, uploadId);
            }
        });

        this.uploads.set(uploadId, { uploader, file, type: 'tus' });

        return uploader.upload(file, { folderId: this.folderId || '' });
    }

    /**
     * Upload using standard multipart form (for smaller files)
     */
    uploadStandard(file) {
        return new Promise((resolve, reject) => {
            const uploadId = this.generateId();
            const formData = new FormData();
            formData.append('file', file);
            if (this.folderId) {
                formData.append('folderId', this.folderId);
            }

            const xhr = new XMLHttpRequest();

            this.uploads.set(uploadId, { xhr, file, type: 'standard' });

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = (e.loaded / e.total) * 100;
                    this.onProgress(file, progress, e.loaded, e.total, uploadId);
                }
            });

            xhr.addEventListener('load', () => {
                this.uploads.delete(uploadId);

                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            this.onComplete(file, uploadId, response);
                            resolve(response);
                        } else {
                            const error = new Error(response.message || 'Upload failed');
                            this.onError(file, error, uploadId);
                            reject(error);
                        }
                    } catch (e) {
                        this.onComplete(file, uploadId);
                        resolve({ success: true });
                    }
                } else {
                    const error = new Error(`Upload failed with status ${xhr.status}`);
                    this.onError(file, error, uploadId);
                    reject(error);
                }
            });

            xhr.addEventListener('error', () => {
                this.uploads.delete(uploadId);
                const error = new Error('Network error during upload');
                this.onError(file, error, uploadId);
                reject(error);
            });

            xhr.addEventListener('abort', () => {
                this.uploads.delete(uploadId);
                reject(new Error('Upload cancelled'));
            });

            xhr.open('POST', this.uploadEndpoint);
            xhr.setRequestHeader('RequestVerificationToken', this.antiForgeryToken);
            xhr.send(formData);
        });
    }

    /**
     * Cancel an upload
     */
    cancelUpload(uploadId) {
        const upload = this.uploads.get(uploadId);
        if (!upload) return;

        if (upload.type === 'tus' && upload.uploader) {
            upload.uploader.aborted = true;
            // Note: uploadUrl would need to be tracked for cancel
        } else if (upload.type === 'standard' && upload.xhr) {
            upload.xhr.abort();
        }

        this.uploads.delete(uploadId);
    }

    /**
     * Cancel all uploads
     */
    cancelAll() {
        for (const [uploadId] of this.uploads) {
            this.cancelUpload(uploadId);
        }
    }

    getAntiForgeryToken() {
        const input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    generateId() {
        return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TusUploader, FileUploadManager };
}
