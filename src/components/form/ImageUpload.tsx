import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { DragEvent } from 'react';
import { Camera, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import type { Options } from 'browser-image-compression';
import { Button } from '@/components/ui/button';

type ImageUploadProps = {
  onImageSelect: (compressedFile: File) => void;
  label?: string;
  accept?: string;
};

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelect,
  label = 'Upload de Imagem',
  accept = 'image/*',
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Função para processar o arquivo selecionado com compressão
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Apenas arquivos de imagem são permitidos.');
      return;
    }

    // Revoga URL anterior do preview
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview(URL.createObjectURL(file));
    setError(null);
    setLoading(true);

    try {
      const options: Options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressed: Blob = await imageCompression(file, options);
      // A biblioteca pode devolver um Blob; o formulário valida as imagens com z.instanceof(File).
      const compressedFile = compressed instanceof File
        ? compressed
        : new File([compressed], file.name, { type: compressed.type || file.type, lastModified: Date.now() });
      onImageSelect(compressedFile);
    } catch (err) {
      console.error('Erro na compressão:', err);
      setError('Erro ao comprimir a imagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [onImageSelect, preview]);

  // Manipulador para mudança no input file
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      // Limpa o valor do input para permitir seleção do mesmo arquivo novamente
      e.target.value = '';
    }
  }, [handleFileSelect]);

  // Manipuladores de drag and drop
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Clique para abrir seletor de arquivo
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Teclas de acessibilidade
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Preview da imagem */}
      {preview && (
        <div className="mb-4">
          <img
            src={preview}
            alt="Preview da imagem selecionada"
            className="w-full h-48 object-cover rounded-lg shadow-md border-2 border-gray-200"
          />
        </div>
      )}

      {/* Zona de upload */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : loading
            ? 'border-gray-400 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        } ${loading ? 'opacity-70' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={loading}
          aria-hidden="true"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept={accept}
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
          disabled={loading}
          aria-hidden="true"
        />

        {loading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-700">Comprimindo imagem...</p>
          </>
        ) : (
          <>
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700 mb-2">{label}</p>
            <p className="text-sm text-gray-500">
              Clique ou arraste uma imagem para cá
            </p>
          </>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full sm:hidden"
        onClick={() => cameraInputRef.current?.click()}
        disabled={loading}
      >
        <Camera aria-hidden="true" />
        Tirar foto com a câmera
      </Button>

      {/* Mensagem de erro */}
      {error && (
        <p id="upload-error" role="alert" className="text-red-500 text-sm mt-2 text-center">
          {error}
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
