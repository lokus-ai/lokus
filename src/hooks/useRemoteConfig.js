import { useContext } from 'react';
import { RemoteConfigContext } from '../contexts/RemoteConfigContext';

export const useRemoteConfig = () => {
    const context = useContext(RemoteConfigContext);

    if (context === undefined) {
        throw new Error('useRemoteConfig must be used within a RemoteConfigProvider');
    }

    return context;
};
