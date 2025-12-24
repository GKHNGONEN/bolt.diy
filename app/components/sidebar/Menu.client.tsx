import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { SettingsButton, HelpButton } from '~/components/ui/SettingsButton';
import { Button } from '~/components/ui/Button';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-360px', // Increased width
    transition: {
      duration: 0.3,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.3,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 px-6 py-4 text-sm text-bolt-elements-textSecondary border-b border-bolt-elements-borderColor">
      <div className="h-4 w-4 i-ph:clock opacity-80" />
      <div className="flex gap-2">
        <span>{dateTime.toLocaleDateString()}</span>
        <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }
      await deleteById(db, id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      deleteChat(item.id)
        .then(() => {
          toast.success('Chat deleted successfully');
          loadEntries();
          if (chatId.get() === item.id) {
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        return;
      }

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;
          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          errors.push(id);
        }
      }

      if (errors.length === 0) {
        toast.success(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`);
      }

      await loadEntries();
      setSelectedItems([]);
      setSelectionMode(false);

      if (shouldNavigate) {
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, db],
  );

  const closeDialog = () => setDialogContent(null);

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }
    const selectedChats = list.filter((item) => selectedItems.includes(item.id));
    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }
    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]);

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));
      return allFilteredAreSelected ? prev.filter((id) => !allFilteredIds.includes(id)) : [...new Set([...prev, ...allFilteredIds])];
    });
  }, [filteredList]);

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) return;
      if (event.pageX < enterThreshold) setOpen(true);
      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) setOpen(false);
    }

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries();
  };

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '360px' }} // Increased width
        className={classNames(
          'flex flex-col side-menu fixed top-0 h-full rounded-r-2xl',
          'bg-bolt-elements-bg-depth-2 border-r border-bolt-elements-borderColor shadow-2xl', // Enhanced shadow
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-bolt-elements-borderColor">
          <div className="text-bolt-elements-textPrimary font-semibold"></div>
          <div className="flex items-center gap-4">
            <HelpButton onClick={() => window.open('https://stackblitz-labs.github.io/bolt.diy/', '_blank')} />
            <span className="font-medium text-sm text-bolt-elements-textPrimary truncate">
              {profile?.username || 'Misafir Kullanıcı'}
            </span>
            <div className="flex items-center justify-center w-9 h-9 overflow-hidden bg-bolt-elements-bg-depth-3 rounded-full shrink-0">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile?.username || 'Kullanıcı'} className="w-full h-full object-cover" />
              ) : (
                <div className="i-ph:user-fill text-lg text-bolt-elements-icon-secondary" />
              )}
            </div>
          </div>
        </div>
        <CurrentDateTime />
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex gap-3">
              <a
                href="/"
                className="flex-1 flex gap-3 items-center bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover rounded-pill px-5 py-3 transition-all"
              >
                <span className="inline-block i-ph:plus-circle text-lg" />
                <span className="text-sm font-semibold">Yeni sohbet başlat</span>
              </a>
              <button
                onClick={toggleSelectionMode}
                className={classNames(
                  'flex items-center justify-center w-12 h-12 rounded-full transition-all',
                  selectionMode
                    ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                    : 'bg-bolt-elements-bg-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-bg-depth-4',
                )}
                aria-label={selectionMode ? 'Seçim modundan çık' : 'Seçim moduna gir'}
              >
                <span className={selectionMode ? 'i-ph:x text-lg' : 'i-ph:check-square text-lg'} />
              </button>
            </div>
            <div className="relative w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass h-5 w-5 text-bolt-elements-textTertiary" />
              </div>
              <input
                className="w-full bg-bolt-elements-bg-depth-3 pl-12 pr-4 py-3 rounded-pill focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary border-2 border-transparent"
                type="search"
                placeholder="Sohbetleri ara..."
                onChange={handleSearchChange}
                aria-label="Sohbetleri ara"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm px-6 py-3 border-t border-b border-bolt-elements-borderColor">
            <div className="font-semibold text-bolt-elements-textPrimary">Sohbetleriniz</div>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedItems.length === filteredList.length ? 'Tüm seçimi kaldır' : 'Tümünü seç'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDeleteClick} disabled={selectedItems.length === 0}>
                  Seçilenleri sil
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto px-4 py-2 modern-scrollbar">
            {filteredList.length === 0 && (
              <div className="px-4 py-8 text-center text-bolt-elements-textSecondary text-sm">
                {list.length === 0 ? 'Geçmiş sohbet bulunmuyor' : 'Eşleşme bulunamadı'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-4 first:mt-0">
                  <div className="text-xs font-semibold text-bolt-elements-textTertiary sticky top-0 bg-bolt-elements-bg-depth-2/80 backdrop-blur-sm px-4 py-2">
                    {category}
                  </div>
                  <div className="space-y-1 p-2">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDialogContent({ type: 'delete', item });
                        }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6">
                      <DialogTitle>Sohbeti Sil?</DialogTitle>
                      <DialogDescription className="mt-2">
                        <p>Şunu silmek üzeresiniz: <span className="font-semibold">{dialogContent.item.description}</span></p>
                        <p className="mt-2">Bu sohbeti silmek istediğinizden emin misiniz?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-bg-depth-3 border-t border-bolt-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>İptal</DialogButton>
                      <DialogButton type="danger" onClick={(event) => { deleteItem(event, dialogContent.item); closeDialog(); }}>Sil</DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6">
                      <DialogTitle>Seçili Sohbetleri Sil?</DialogTitle>
                      <DialogDescription className="mt-2">
                        <p>{dialogContent.items.length} {dialogContent.items.length === 1 ? 'sohbeti' : 'sohbetleri'} silmek üzeresiniz:</p>
                        <div className="mt-3 max-h-40 overflow-auto border border-bolt-elements-borderColor rounded-md bg-bolt-elements-bg-depth-3 p-3">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => <li key={item.id} className="text-sm font-semibold">{item.description}</li>)}
                          </ul>
                        </div>
                        <p className="mt-4">Bu sohbetleri silmek istediğinizden emin misiniz?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-bg-depth-3 border-t border-bolt-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>İptal</DialogButton>
                      <DialogButton type="danger" onClick={() => { deleteSelectedItems([...selectedItems]); closeDialog(); }}>Sil</DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-between border-t border-bolt-elements-borderColor px-6 py-4">
            <div className="flex items-center gap-3">
              <SettingsButton onClick={() => setIsSettingsOpen(true)} />
            </div>
            <ThemeSwitch />
          </div>
        </div>
      </motion.div>
      <ControlPanel open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
