import React, { useEffect, useState } from 'react';
import { uiManager } from '../core/ui/UIManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { QuickPick } from './QuickPick';

export function PluginDialogContainer() {
    const [dialogs, setDialogs] = useState([]);

    useEffect(() => {
        const onShowDialog = (dialog) => {
            setDialogs(prev => [...prev, dialog]);
        };

        const onDismissDialog = (id) => {
            setDialogs(prev => prev.filter(d => d.id !== id));
        };

        uiManager.on('show-dialog', onShowDialog);
        uiManager.on('dismiss-dialog', onDismissDialog);

        return () => {
            uiManager.off('show-dialog', onShowDialog);
            uiManager.off('dismiss-dialog', onDismissDialog);
        };
    }, []);

    const handleClose = (id, result) => {
        const dialog = dialogs.find(d => d.id === id);
        if (dialog) {
            if (dialog.type === 'inputbox' && dialog.onCancel && result === undefined) {
                dialog.onCancel();
            } else if (dialog.type === 'inputbox' && dialog.onAccept && result !== undefined) {
                dialog.onAccept(result);
            } else if (dialog.onClose) {
                dialog.onClose(result);
            }
        }
        setDialogs(prev => prev.filter(d => d.id !== id));
    };

    return (
        <>
            {dialogs.map(dialog => (
                <PluginDialog key={dialog.id} dialog={dialog} onClose={(result) => handleClose(dialog.id, result)} />
            ))}
        </>
    );
}

function PluginDialog({ dialog, onClose }) {
    const [inputValue, setInputValue] = useState(dialog.options?.value || '');

    const handleOpenChange = (open) => {
        if (!open) {
            onClose(undefined);
        }
    };

    if (dialog.type === 'message') {
        return (
            <Dialog open={true} onOpenChange={handleOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialog.severity === 'error' ? 'Error' : dialog.severity === 'warning' ? 'Warning' : 'Information'}</DialogTitle>
                        <DialogDescription>{dialog.message}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        {dialog.buttons && dialog.buttons.length > 0 ? (
                            dialog.buttons.map((btn, idx) => (
                                <Button key={idx} onClick={() => onClose(btn)}>{btn.title || btn}</Button>
                            ))
                        ) : (
                            <Button onClick={() => onClose(undefined)}>OK</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    if (dialog.type === 'inputbox') {
        return (
            <Dialog open={true} onOpenChange={handleOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialog.options?.title || 'Input'}</DialogTitle>
                        <DialogDescription>{dialog.options?.prompt || ''}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={dialog.options?.placeholder}
                            type={dialog.options?.password ? 'password' : 'text'}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onClose(inputValue);
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onClose(undefined)}>Cancel</Button>
                        <Button onClick={() => onClose(inputValue)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    if (dialog.type === 'quickpick') {
        return (
            <QuickPick
                items={dialog.items || []}
                options={dialog.options || {}}
                onSelect={(selected) => {
                    if (dialog.onSelect) {
                        dialog.onSelect(selected);
                    }
                    onClose(selected);
                }}
                onCancel={() => {
                    if (dialog.onCancel) {
                        dialog.onCancel();
                    }
                    onClose(undefined);
                }}
                isOpen={true}
            />
        );
    }

    return null;
}
