import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * ImageCropper - A modal component for cropping images before upload
 * 
 * Props:
 * - imageSrc: string - The source URL of the image to crop
 * - onCropComplete: (croppedBlob: Blob) => void - Callback with the cropped image blob
 * - onCancel: () => void - Callback when cropping is cancelled
 * - aspectRatio: number - Optional aspect ratio (e.g., 1 for square, 16/9 for widescreen)
 * - minWidth: number - Minimum width of crop area in pixels
 * - minHeight: number - Minimum height of crop area in pixels
 */
const ImageCropper = ({
    imageSrc,
    onCropComplete,
    onCancel,
    aspectRatio = undefined, // undefined = free-form, 1 = square
    minWidth = 50,
    minHeight = 50,
    title = 'Crop Image'
}) => {
    const [crop, setCrop] = useState({
        unit: '%',
        width: 80,
        height: 80,
        x: 10,
        y: 10,
    });
    const [completedCrop, setCompletedCrop] = useState(null);
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const imgRef = useRef(null);

    // Generate cropped image blob
    const getCroppedImg = useCallback(async () => {
        if (!completedCrop || !imgRef.current) {
            console.error('No crop or image reference');
            return null;
        }

        const image = imgRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.error('No 2d context');
            return null;
        }

        // Calculate the scale factors
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // Set canvas size to the cropped area size
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = completedCrop.width * scaleX * pixelRatio;
        canvas.height = completedCrop.height * scaleY * pixelRatio;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.imageSmoothingQuality = 'high';

        // Handle rotation if needed
        if (rotation !== 0) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
        }

        // Draw the cropped image
        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY
        );

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    resolve(blob);
                },
                'image/png',
                1
            );
        });
    }, [completedCrop, rotation]);

    const handleCropComplete = async () => {
        const croppedBlob = await getCroppedImg();
        if (croppedBlob) {
            onCropComplete(croppedBlob);
        }
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    const handleZoomIn = () => {
        setScale((prev) => Math.min(prev + 0.1, 3));
    };

    const handleZoomOut = () => {
        setScale((prev) => Math.max(prev - 0.1, 0.5));
    };

    const handleResetCrop = () => {
        setCrop({
            unit: '%',
            width: 80,
            height: 80,
            x: 10,
            y: 10,
        });
        setScale(1);
        setRotation(0);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Crop Area */}
                <div className="p-6 bg-gray-100">
                    <div className="flex items-center justify-center max-h-[400px] overflow-hidden rounded-lg bg-gray-800">
                        <ReactCrop
                            crop={crop}
                            onChange={(c) => setCrop(c)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={aspectRatio}
                            minWidth={minWidth}
                            minHeight={minHeight}
                            className="max-h-[400px]"
                        >
                            <img
                                ref={imgRef}
                                src={imageSrc}
                                alt="Crop preview"
                                style={{
                                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                                    maxHeight: '400px',
                                    objectFit: 'contain',
                                }}
                                className="transition-transform duration-200"
                            />
                        </ReactCrop>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                            onClick={handleZoomOut}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4 text-gray-600" />
                        </button>
                        <div className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600">
                            {Math.round(scale * 100)}%
                        </div>
                        <button
                            onClick={handleZoomIn}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4 text-gray-600" />
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-2" />
                        <button
                            onClick={handleRotate}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            title="Rotate 90°"
                        >
                            <RotateCcw className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                            onClick={handleResetCrop}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Instructions */}
                <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs text-blue-700 text-center">
                        Drag the corners or edges to adjust the crop area. Remove empty margins to make your logo display larger.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCropComplete}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Check className="w-4 h-4" />
                        Apply Crop
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
