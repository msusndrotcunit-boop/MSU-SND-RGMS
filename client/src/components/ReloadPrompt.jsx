import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Toaster, toast } from 'react-hot-toast';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  React.useEffect(() => {
    if (offlineReady) {
      toast.success('App ready to work offline');
    }
  }, [offlineReady]);

  React.useEffect(() => {
    if (needRefresh) {
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span>New content available, click on reload button to update.</span>
          <div className="flex gap-2">
            <button 
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
              onClick={() => updateServiceWorker(true)}
            >
              Reload
            </button>
            <button 
              className="bg-gray-200 px-3 py-1 rounded text-sm"
              onClick={() => {
                close();
                toast.dismiss(t.id);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ), {
        duration: Infinity,
        position: 'bottom-right',
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}

export default ReloadPrompt;
