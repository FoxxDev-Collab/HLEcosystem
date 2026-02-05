// File Upload with Drag & Drop and Progress Tracking

(function () {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');

    if (!dropZone || !fileInput || !uploadForm) {
        return;
    }

    // Upload queue management
    const uploadQueue = [];
    let uploadQueueContainer = null;

    // Initialize upload queue container
    function initUploadQueue() {
        if (!uploadQueueContainer) {
            uploadQueueContainer = document.createElement('div');
            uploadQueueContainer.id = 'uploadQueueContainer';
            uploadQueueContainer.className = 'upload-queue-container';
            uploadQueueContainer.innerHTML = `
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">
                            <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 16 16' class="me-2">
                                <path d='M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z'/>
                                <path d='M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z'/>
                            </svg>
                            Upload Queue
                        </h6>
                        <div class="d-flex align-items-center gap-2">
                            <span id="queueStatus" class="text-muted small"></span>
                            <button type="button" class="btn-close btn-sm" onclick="document.getElementById('uploadQueueContainer').remove()"></button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="overallProgress" class="mb-3" style="display: none;">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="small fw-medium">Overall Progress</span>
                                <span id="overallPercentage" class="small text-muted">0%</span>
                            </div>
                            <div class="progress" style="height: 8px;">
                                <div id="overallProgressBar" class="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                                     role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div id="uploadQueueItems"></div>
                    </div>
                </div>
            `;

            // Insert after the drop zone
            dropZone.parentNode.insertBefore(uploadQueueContainer, dropZone.nextSibling);
        }
        return uploadQueueContainer;
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    // Get file icon based on content type
    function getFileIcon(contentType) {
        if (contentType.startsWith('image/')) return 'file-image';
        if (contentType.startsWith('video/')) return 'file-earmark-play';
        if (contentType.startsWith('audio/')) return 'file-earmark-music';
        if (contentType.includes('pdf')) return 'file-earmark-pdf';
        if (contentType.includes('word') || contentType.includes('document')) return 'file-earmark-word';
        if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'file-earmark-excel';
        if (contentType.includes('zip') || contentType.includes('compressed')) return 'file-earmark-zip';
        return 'file-earmark';
    }

    // Create upload item UI
    function createUploadItem(file, index) {
        const itemId = `upload-item-${index}`;
        const icon = getFileIcon(file.type);

        return `
            <div id="${itemId}" class="upload-item mb-3 p-3 border rounded" style="animation: fadeIn 0.3s ease-in;">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="d-flex align-items-center gap-2 flex-grow-1">
                        <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='currentColor' viewBox='0 0 16 16'>
                            <path d='M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z'/>
                        </svg>
                        <div class="flex-grow-1 text-truncate">
                            <div class="fw-medium text-truncate" title="${file.name}">${file.name}</div>
                            <div class="text-muted small">${formatFileSize(file.size)}</div>
                        </div>
                    </div>
                    <span id="${itemId}-badge" class="badge bg-secondary">Pending</span>
                </div>
                <div id="${itemId}-progress" style="display: none;">
                    <div class="progress" style="height: 6px;">
                        <div id="${itemId}-progress-bar" class="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                             role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <div class="text-muted small mt-1" id="${itemId}-status">Preparing...</div>
                </div>
                <div id="${itemId}-error" class="alert alert-danger small mt-2 mb-0" style="display: none;"></div>
            </div>
        `;
    }

    // Update overall progress
    function updateOverallProgress() {
        const total = uploadQueue.length;
        const completed = uploadQueue.filter(item => item.status === 'completed' || item.status === 'error').length;
        const percentage = Math.round((completed / total) * 100);

        const overallProgressBar = document.getElementById('overallProgressBar');
        const overallPercentage = document.getElementById('overallPercentage');
        const queueStatus = document.getElementById('queueStatus');

        if (overallProgressBar && overallPercentage) {
            overallProgressBar.style.width = percentage + '%';
            overallProgressBar.setAttribute('aria-valuenow', percentage);
            overallPercentage.textContent = percentage + '%';

            if (percentage === 100) {
                overallProgressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
                overallProgressBar.classList.add('bg-success');
            }
        }

        if (queueStatus) {
            const successCount = uploadQueue.filter(item => item.status === 'completed').length;
            const errorCount = uploadQueue.filter(item => item.status === 'error').length;
            queueStatus.textContent = `${completed} of ${total} files processed`;

            if (percentage === 100) {
                if (errorCount > 0) {
                    queueStatus.innerHTML = `<span class="text-warning">${successCount} succeeded, ${errorCount} failed</span>`;
                } else {
                    queueStatus.innerHTML = `<span class="text-success">All files uploaded successfully</span>`;
                }
            }
        }
    }

    // Get upload URL from form data attribute or default to Files controller
    function getUploadUrl() {
        const form = document.getElementById('uploadForm');
        if (form) {
            // Check for data-upload-url attribute first (used for AJAX uploads)
            const uploadUrl = form.getAttribute('data-upload-url');
            if (uploadUrl) {
                return uploadUrl;
            }
        }
        // Default to Files controller if no form found
        return '/Files/UploadFile';
    }

    // Upload single file with progress tracking
    function uploadFile(file, index, folderId, groupId) {
        const itemId = `upload-item-${index}`;
        const progressBar = document.getElementById(`${itemId}-progress-bar`);
        const progressContainer = document.getElementById(`${itemId}-progress`);
        const statusText = document.getElementById(`${itemId}-status`);
        const badge = document.getElementById(`${itemId}-badge`);
        const errorContainer = document.getElementById(`${itemId}-error`);

        // Show progress UI
        if (progressContainer) progressContainer.style.display = 'block';
        if (badge) {
            badge.textContent = 'Uploading';
            badge.className = 'badge bg-primary';
        }

        uploadQueue[index].status = 'uploading';

        const formData = new FormData();
        formData.append('file', file);
        if (folderId) formData.append('folderId', folderId);
        if (groupId) formData.append('groupId', groupId);

        // Get anti-forgery token
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;

        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (progressBar) {
                    progressBar.style.width = percentComplete + '%';
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                }
                if (statusText) {
                    statusText.textContent = `Uploading... ${percentComplete}%`;
                }
            }
        });

        // Handle completion
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        uploadQueue[index].status = 'completed';
                        if (progressBar) {
                            progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
                            progressBar.classList.add('bg-success');
                            progressBar.style.width = '100%';
                        }
                        if (statusText) statusText.textContent = 'Upload complete!';
                        if (badge) {
                            badge.textContent = 'Completed';
                            badge.className = 'badge bg-success';
                        }
                    } else {
                        throw new Error(response.message || 'Upload failed');
                    }
                } catch (error) {
                    uploadQueue[index].status = 'error';
                    if (progressBar) {
                        progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
                        progressBar.classList.add('bg-danger');
                    }
                    if (badge) {
                        badge.textContent = 'Failed';
                        badge.className = 'badge bg-danger';
                    }
                    if (errorContainer) {
                        errorContainer.textContent = error.message;
                        errorContainer.style.display = 'block';
                    }
                    if (statusText) statusText.textContent = 'Upload failed';
                }
            } else {
                uploadQueue[index].status = 'error';
                if (progressBar) {
                    progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
                    progressBar.classList.add('bg-danger');
                }
                if (badge) {
                    badge.textContent = 'Failed';
                    badge.className = 'badge bg-danger';
                }
                if (errorContainer) {
                    errorContainer.textContent = `Server error: ${xhr.status}`;
                    errorContainer.style.display = 'block';
                }
                if (statusText) statusText.textContent = 'Upload failed';
            }

            updateOverallProgress();

            // Check if all uploads are done
            const allDone = uploadQueue.every(item => item.status === 'completed' || item.status === 'error');
            if (allDone) {
                // Reload page after a short delay if all succeeded
                const allSuccess = uploadQueue.every(item => item.status === 'completed');
                if (allSuccess) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            }
        });

        // Handle errors
        xhr.addEventListener('error', function() {
            uploadQueue[index].status = 'error';
            if (progressBar) {
                progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
                progressBar.classList.add('bg-danger');
            }
            if (badge) {
                badge.textContent = 'Failed';
                badge.className = 'badge bg-danger';
            }
            if (errorContainer) {
                errorContainer.textContent = 'Network error occurred';
                errorContainer.style.display = 'block';
            }
            if (statusText) statusText.textContent = 'Upload failed';
            updateOverallProgress();
        });

        // Send request to the correct endpoint
        const uploadUrl = getUploadUrl();
        xhr.open('POST', uploadUrl, true);
        if (token) {
            xhr.setRequestHeader('RequestVerificationToken', token);
        }
        xhr.send(formData);
    }

    // Get group ID from form if present
    function getGroupId() {
        const groupIdInput = document.querySelector('input[name="groupId"]');
        return groupIdInput ? groupIdInput.value : null;
    }

    // Process upload queue
    function processUploadQueue(files, folderId) {
        const groupId = getGroupId();
        const container = initUploadQueue();
        const queueItems = document.getElementById('uploadQueueItems');
        const overallProgress = document.getElementById('overallProgress');

        // Clear previous queue
        uploadQueue.length = 0;
        if (queueItems) queueItems.innerHTML = '';

        // Add files to queue
        Array.from(files).forEach((file, index) => {
            uploadQueue.push({
                file: file,
                index: index,
                status: 'pending'
            });

            if (queueItems) {
                queueItems.innerHTML += createUploadItem(file, index);
            }
        });

        // Show overall progress
        if (overallProgress) overallProgress.style.display = 'block';
        updateOverallProgress();

        // Start uploading files sequentially
        uploadQueue.forEach((item, index) => {
            setTimeout(() => {
                uploadFile(item.file, index, folderId, groupId);
            }, index * 100); // Stagger uploads slightly
        });
    }

    // Get current folder ID from URL or form
    function getCurrentFolderId() {
        const urlParams = new URLSearchParams(window.location.search);
        const folderIdFromUrl = urlParams.get('folderId');
        if (folderIdFromUrl) return folderIdFromUrl;

        const folderIdInput = document.querySelector('input[name="currentFolderId"]');
        return folderIdInput ? folderIdInput.value : null;
    }

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    // Handle file selection via input
    fileInput.addEventListener('change', handleFiles, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.classList.add('drag-over');
    }

    function unhighlight(e) {
        dropZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const folderId = getCurrentFolderId();
            processUploadQueue(files, folderId);
        }
    }

    function handleFiles(e) {
        if (fileInput.files.length > 0) {
            const folderId = getCurrentFolderId();
            processUploadQueue(fileInput.files, folderId);
        }
    }
})();
