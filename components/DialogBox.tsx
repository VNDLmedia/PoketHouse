import React, { useEffect, useState, useRef } from 'react';

interface DialogBoxProps {
  text: string[];
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
}

export const DialogBox: React.FC<DialogBoxProps> = ({ text, isOpen, onClose }) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Platzhalter für Sound

  useEffect(() => {
    if (isOpen) {
      setCurrentLine(0);
      setDisplayText('');
      setIsTyping(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (currentLine >= text.length) {
      onClose();
      return;
    }

    const line = text[currentLine];
    let i = 0;
    setDisplayText('');
    setIsTyping(true);

    const interval = setInterval(() => {
      setDisplayText((prev) => {
        if (i >= line.length) {
          clearInterval(interval);
          setIsTyping(false);
          return prev;
        }
        i++;
        return line.substring(0, i);
      });
    }, 25); 

    return () => clearInterval(interval);
  }, [currentLine, isOpen, text, onClose]);

  const handleNext = () => {
    if (isTyping) {
      setDisplayText(text[currentLine]);
      setIsTyping(false);
    } else {
      if (currentLine < text.length - 1) {
        setCurrentLine((prev) => prev + 1);
      } else {
        onClose();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault(); // Verhindert Scrollen
            handleNext();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTyping, currentLine]); // eslint-disable-line

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[700px] z-50">
      <div className="
        bg-[#212529] 
        text-[#f8f9fa] 
        border-4 border-[#dee2e6] 
        shadow-[0_10px_30px_rgba(0,0,0,0.5)] 
        rounded-lg 
        p-6 
        font-mono 
        text-lg 
        relative
      ">
        {/* Dekorativer Header */}
        <div className="absolute -top-3 left-6 bg-[#212529] px-2 text-[#adb5bd] text-xs uppercase tracking-widest font-bold">
            Nachricht
        </div>

        <div className="min-h-[3.5rem] leading-relaxed">
            {displayText}
            <span className="animate-pulse inline-block w-2 h-4 bg-white ml-1 align-middle opacity-50"></span>
        </div>
        
        <div className="mt-2 flex justify-end">
            <span className="text-xs text-[#ced4da] bg-[#343a40] px-2 py-1 rounded animate-pulse">
                ▼ WEITER [SPACE]
            </span>
        </div>
      </div>
    </div>
  );
};
