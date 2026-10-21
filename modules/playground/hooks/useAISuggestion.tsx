import { useState, useCallback } from "react";
import type { editor } from "monaco-editor";

type CodeEditor = editor.IStandaloneCodeEditor;


interface AISuggestionsState {
    suggestion: string | null;
    isLoading: boolean;
    position: { line: number; column: number } | null;
    decoration: string[];
    isEnabled: boolean;
}

interface UseAISuggestionsReturn extends AISuggestionsState {
    toggleEnabled: () => void;
    fetchSuggestion: (type: string, editor: CodeEditor) => Promise<void>;
    /** The editor inserts the text itself; this only clears the hook state */
    acceptSuggestion: (editor: CodeEditor) => void;
    rejectSuggestion: (editor: CodeEditor) => void;
    clearSuggestion: (editor: CodeEditor) => void;
}

export const useAISuggestions = (): UseAISuggestionsReturn => {
    const [state, setState] = useState<AISuggestionsState>({
        suggestion: null,
        isLoading: false,
        position: null,
        decoration: [],
        isEnabled: true,
    });

    const toggleEnabled = useCallback(() => {
        setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
    }, [])

    const fetchSuggestion = useCallback(async (type: string, editor: CodeEditor) => {
        setState((currentState) => {

            if (!currentState.isEnabled) {
                return currentState
            }

            if (!editor) {
                return currentState
            }

            const model = editor.getModel();
            const cursorPosition = editor.getPosition()

            if (!model || !cursorPosition) {
                return currentState
            }

            const newState = { ...currentState, isLoading: true };

            (async () => {
                try {
                    const payload = {
                        fileContent: model.getValue(),
                        cursorLine: cursorPosition.lineNumber - 1,
                        cursorColumn: cursorPosition.column - 1,
                        suggestionType: type
                    }

                    const response = await fetch("/api/code-completion", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    })
                    if (!response.ok) {
                        throw new Error(`API responded with status ${response.status}`);
                    }

                    const data = await response.json()

                    if (data.suggestion) {
                        const suggestionText = data.suggestion.trim();
                        setState((prev) => ({
                            ...prev,
                            suggestion: suggestionText,
                            position: {
                                line: cursorPosition.lineNumber,
                                column: cursorPosition.column
                            },
                            isLoading: false
                        }))
                    }
                    else {
                        console.warn("No suggestion received from API.");
                        setState((prev) => ({ ...prev, isLoading: false }));
                    }
                } catch (error) {
                    console.error("Error fetching code suggestion:", error);
                    setState((prev) => ({ ...prev, isLoading: false }));
                }
            })();

            return newState
        })
    }, [])


    // PlaygroundEditor already inserted the text with executeEdits, so here we
    // only clear the suggestion (inserting again would duplicate the code)
    const acceptSuggestion = useCallback((editor: CodeEditor) => {
        setState((currentState) => {
            if (currentState.decoration.length > 0) {
                editor.deltaDecorations(currentState.decoration, [])
            }

            return {
                ...currentState,
                suggestion: null,
                position: null,
                decoration: []
            }
        })
    }, [])

    const rejectSuggestion = useCallback((editor: CodeEditor)=>{
            setState((currentState)=>{
                 if(editor && currentState.decoration.length > 0){
                    editor.deltaDecorations(currentState.decoration , [])
                }

                return {
                    ...currentState,
                    suggestion:null,
                    position:null,
                    decoration:[]
                }
            })
    },[]);
 
    const clearSuggestion = useCallback((editor: CodeEditor) => {
    setState((currentState) => {
      if (editor && currentState.decoration.length > 0) {
        editor.deltaDecorations(currentState.decoration, []);
      }
      return {
        ...currentState,
        suggestion: null,
        position: null,
        decoration: [],
      };
    });
  }, []);


  return {
    ...state,
    toggleEnabled,
    fetchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion
  }

}