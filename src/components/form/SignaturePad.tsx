import { FC, useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';

// Interface para as props do componente SignaturePad
interface SignaturePadProps {
  label: string;
  onSignatureCapture: (dataUrl: string) => void;
}

const SignaturePad: FC<SignaturePadProps> = ({ label, onSignatureCapture }) => {
  // Referência para acessar os métodos do canvas de assinatura.
  const canvasRef = useRef<SignatureCanvas | null>(null);

  // Estados: isSigned indica se há assinatura desenhada, showError para exibir mensagem de erro
  const [isSigned, setIsSigned] = useState(false);
  const [showError, setShowError] = useState(false);

  // Função para limpar o canvas e resetar os estados
  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setIsSigned(false);
    setShowError(false);
  }, []);

  // Função para confirmar a assinatura: valida se não está vazio, captura dataURL e chama callback
  const handleConfirm = useCallback(() => {
    if (canvasRef.current?.isEmpty()) {
      setShowError(true);
      return;
    }
    const dataUrl = canvasRef.current?.toDataURL();
    if (dataUrl) {
      onSignatureCapture(dataUrl);
    }
  }, [onSignatureCapture]);

  // Callback para início do desenho: marca como assinada e limpa erro
  const handleBegin = useCallback(() => {
    setIsSigned(true);
    setShowError(false);
  }, []);

  // Callback para fim do desenho: confirma que há assinatura
  const handleEnd = useCallback(() => {
    setIsSigned(true);
  }, []);

  return (
    <div className="space-y-3">
      {/* Label acessível para o canvas */}
      <label
        htmlFor="signatureCanvas"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>

      {/* Canvas da assinatura com altura responsiva, estilos Tailwind e acessibilidade ARIA */}
      <SignatureCanvas
        ref={canvasRef}
        canvasProps={{
          id: "signatureCanvas",
          className: `w-full h-64 md:h-80 border-2 border-dashed ${
            showError
              ? 'border-red-400 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          } rounded-xl bg-white dark:bg-gray-800 p-4 touch-manipulation select-none`,
          "aria-invalid": showError ? "true" : "false",
          "aria-describedby": showError ? "signatureError" : undefined,
          "aria-label": "Área para desenhar a assinatura"
        }}
        penColor="black"
        onBegin={handleBegin}
        onEnd={handleEnd}
        clearOnResize={false}
      />

      {/* Mensagem de erro com role="alert" e ARIA para acessibilidade */}
      {showError && (
        <div
          id="signatureError"
          role="alert"
          aria-live="polite"
          className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-md text-sm"
        >
          Por favor, forneça sua assinatura no campo acima.
        </div>
      )}

      {/* Container dos botões responsivo (stack em mobile, row em sm+) */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Botão Limpar: sempre habilitado, com hover/focus/disabled Tailwind */}
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 px-6 py-3 text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 shadow-sm"
          aria-label="Limpar a assinatura desenhada"
        >
          Limpar Assinatura
        </button>

        {/* Botão Confirmar: desabilitado até assinar, com estilos condicionais Tailwind */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isSigned}
          className="flex-1 px-6 py-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-blue-600 text-white shadow-sm"
          aria-label="Confirmar a assinatura desenhada"
        >
          Confirmar Assinatura
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
