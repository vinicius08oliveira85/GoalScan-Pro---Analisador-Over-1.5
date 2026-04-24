import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Plus, Edit, Trash2, Eye, X, Upload, Globe } from 'lucide-react';
import { useChampionships } from '../hooks/useChampionships';
import { Championship, ChampionshipTable } from '../types';
import ChampionshipForm from './ChampionshipForm';
import ChampionshipTableView from './ChampionshipTableView';
import ChampionshipTableUpdateModal from './ChampionshipTableUpdateModal';
import { animations } from '../utils/animations';
import { cn } from '../utils/cn';
import TableStatus, { getChampionshipDataFreshnessMs } from './ui/TableStatus';

const ChampionshipCardSkeleton: React.FC = () => (
  <div className="rounded-3xl border border-white/10 bg-base-100/35 p-5 shadow-lg ring-1 ring-white/5 backdrop-blur-md dark:bg-base-100/20">
    <div className="mb-4 flex items-start gap-3">
      <div className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton h-5 w-full max-w-[14rem] rounded-lg" />
        <div className="skeleton h-3 w-40 rounded-md" />
        <div className="skeleton h-3 w-32 rounded-md" />
      </div>
    </div>
    <div className="flex gap-2 pt-2">
      <div className="skeleton h-9 flex-1 rounded-xl" />
      <div className="skeleton h-9 w-9 rounded-xl" />
      <div className="skeleton h-9 w-9 rounded-xl" />
      <div className="skeleton h-9 w-9 rounded-xl" />
    </div>
  </div>
);

const ChampionshipsScreen: React.FC = () => {
  const handleError = (message: string) => {
    console.error('[ChampionshipsScreen]', message);
  };

  const { championships, isLoading, isSaving, save, remove, loadTables, saveTable } =
    useChampionships(handleError);
  const [showForm, setShowForm] = useState(false);
  const [editingChampionship, setEditingChampionship] = useState<Championship | null>(null);
  const [viewingTables, setViewingTables] = useState<{
    championship: Championship;
    tables: ChampionshipTable[];
  } | null>(null);
  const [updatingTables, setUpdatingTables] = useState<{
    championship: Championship;
    tables: ChampionshipTable[];
  } | null>(null);

  const tablePreviewFreshnessMs = useMemo(() => {
    if (!viewingTables) return null;
    return getChampionshipDataFreshnessMs(viewingTables.championship, viewingTables.tables);
  }, [viewingTables]);

  const handleNewChampionship = () => {
    setEditingChampionship(null);
    setShowForm(true);
  };

  const handleEditChampionship = (championship: Championship) => {
    setEditingChampionship(championship);
    setShowForm(true);
  };

  const handleDeleteChampionship = async (championship: Championship) => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir o campeonato "${championship.nome}"? Esta ação não pode ser desfeita.`
      )
    ) {
      await remove(championship.id);
    }
  };

  const handleViewTables = async (championship: Championship) => {
    const tables = await loadTables(championship.id);
    setViewingTables({ championship, tables });
  };

  const handleUpdateTables = async (championship: Championship) => {
    const tables = await loadTables(championship.id);
    setUpdatingTables({ championship, tables });
  };

  const handleSaveChampionship = async (
    championship: Championship,
    tables: ChampionshipTable[]
  ) => {
    try {
      const savedChampionship = await save(championship);

      if (savedChampionship) {
        if (tables.length > 0) {
          for (const table of tables) {
            try {
              const savedTable = await saveTable({
                ...table,
                championship_id: savedChampionship.id,
              });

              if (!savedTable) {
                console.error(`[ChampionshipsScreen] Erro ao salvar tabela ${table.table_type}`);
                handleError(`Erro ao salvar tabela ${table.table_name || table.table_type}`);
              }
            } catch (tableError) {
              console.error(`[ChampionshipsScreen] Erro ao salvar tabela ${table.table_type}:`, tableError);
              handleError(
                `Erro ao salvar tabela ${table.table_name || table.table_type}: ${tableError instanceof Error ? tableError.message : 'Erro desconhecido'}`
              );
            }
          }
        }

        setShowForm(false);
        setEditingChampionship(null);
      } else {
        handleError('Erro ao salvar campeonato');
      }
    } catch (error) {
      console.error('[ChampionshipsScreen] Erro ao salvar campeonato:', error);
      handleError(`Erro ao salvar campeonato: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6 pb-20 md:space-y-8 md:pb-8">
        <div className="skeleton h-10 w-48 rounded-xl sm:h-12 sm:w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ChampionshipCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const modalShell =
    'max-h-[min(92dvh,90vh)] w-full overflow-y-auto rounded-3xl border border-white/10 bg-base-100/92 shadow-2xl shadow-primary/15 ring-1 ring-white/10 backdrop-blur-2xl dark:bg-base-200/90';

  return (
    <div className="relative min-w-0 space-y-6 pb-20 md:space-y-8 md:pb-8">
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pointer-events-none sticky top-0 z-30 overflow-hidden rounded-2xl"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="relative h-1 w-full overflow-hidden bg-base-300/40">
              <motion.div
                className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-primary via-secondary to-primary"
                initial={{ x: '-100%' }}
                animate={{ x: '400%' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="sr-only">Sincronizando com o servidor</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight sm:gap-3 sm:text-3xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner shadow-primary/20 sm:h-11 sm:w-11">
              <Trophy className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden />
            </span>
            <span>Campeonatos</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-base-content/60 sm:text-base">
            Gerencie ligas, importe classificações e mantenha tabelas alinhadas ao seu fluxo de análise.
          </p>
        </div>
        <motion.button
          type="button"
          onClick={handleNewChampionship}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary btn-block gap-2 rounded-2xl font-black shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30 sm:btn-wide sm:min-w-[12rem]"
        >
          <Plus className="h-5 w-5 shrink-0" />
          Novo Campeonato
        </motion.button>
      </div>

      {championships.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-gradient-to-b from-base-100/40 via-base-200/20 to-primary/10 px-6 py-16 text-center shadow-inner backdrop-blur-xl dark:from-base-100/25 dark:to-primary/15 md:py-20"
        >
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
            <Globe className="absolute inset-0 m-auto h-24 w-24 text-secondary/25" strokeWidth={1} aria-hidden />
            <Trophy className="relative h-14 w-14 text-primary/40 sm:h-16 sm:w-16" strokeWidth={1.15} aria-hidden />
          </div>
          <h3 className="text-xl font-black tracking-tight text-base-content sm:text-2xl">Nenhum campeonato ainda</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-base-content/60 sm:text-base">
            Cadastre sua primeira liga e importe a tabela — você ganha contexto rico para análises e odds com dados
            confiáveis.
          </p>
          <motion.button
            type="button"
            onClick={handleNewChampionship}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary btn-lg mt-8 gap-2 rounded-2xl font-black shadow-xl shadow-primary/20"
          >
            <Plus className="h-5 w-5" />
            Criar primeiro campeonato
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          variants={animations.staggerChildren}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
        >
          {championships.map((championship) => {
            const isCompleta = championship.table_format === 'completa';
            const shadowClass = isCompleta
              ? 'shadow-xl shadow-primary/15 hover:shadow-2xl hover:shadow-primary/25'
              : 'shadow-xl shadow-secondary/10 hover:shadow-2xl hover:shadow-secondary/20';

            return (
              <motion.div
                key={championship.id}
                variants={animations.fadeInUp}
                layout
                className={cn(
                  'group flex flex-col rounded-3xl border border-white/10 bg-base-100/40 p-5 ring-1 ring-white/5 backdrop-blur-xl transition-all duration-300',
                  'hover:-translate-y-1 hover:border-primary/25 dark:bg-base-100/25',
                  shadowClass
                )}
              >
                <div className="mb-4 flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner',
                      isCompleta
                        ? 'border-primary/30 bg-primary/12 text-primary'
                        : 'border-secondary/25 bg-secondary/10 text-secondary'
                    )}
                  >
                    <Trophy className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-black leading-snug tracking-tight text-base sm:text-lg">{championship.nome}</h3>
                      {championship.table_format && (
                        <span
                          className={cn(
                            'badge badge-sm shrink-0 font-bold',
                            isCompleta ? 'badge-primary' : 'badge-secondary'
                          )}
                          title={
                            championship.table_format === 'completa'
                              ? 'Planilha completa com dados de xG'
                              : 'Planilha básica sem dados de xG'
                          }
                        >
                          {championship.table_format === 'completa' ? 'Completa' : 'Básica'}
                        </span>
                      )}
                    </div>
                    {(championship.uploaded_at ??
                      championship.updated_at ??
                      championship.created_at) && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <TableStatus
                          updatedAt={
                            championship.uploaded_at ??
                            championship.updated_at ??
                            championship.created_at
                          }
                          className="shadow-inner"
                        />
                      </div>
                    )}
                    <div className="space-y-1 text-[11px] leading-snug text-base-content/60 sm:text-xs">
                      <p>
                        Criado em{' '}
                        <span className="font-mono tabular-nums opacity-80">
                          {championship.created_at
                            ? new Date(championship.created_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </span>
                      </p>
                      {championship.uploaded_at && (
                        <p>
                          Última atualização{' '}
                          <span className="font-mono tabular-nums opacity-80">
                            {new Date(championship.uploaded_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </p>
                      )}
                      {championship.fbrefUrl ? (
                        <p className="truncate opacity-50" title={championship.fbrefUrl}>
                          FBref: {championship.fbrefUrl}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-white/10 pt-4 dark:border-white/5">
                  <motion.button
                    type="button"
                    onClick={() => handleViewTables(championship)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-sm flex-1 gap-1 rounded-xl border border-white/10 bg-base-200/40 font-bold backdrop-blur-sm hover:border-primary/30 hover:bg-primary/10 min-[380px]:flex-none min-[380px]:flex-1"
                    title="Visualizar Tabelas"
                  >
                    <Eye className="h-4 w-4" />
                    Tabelas
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleUpdateTables(championship)}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.96 }}
                    className="btn btn-sm btn-ghost gap-1 rounded-xl hover:bg-secondary/15"
                    title="Atualizar Tabelas (JSON)"
                  >
                    <Upload className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleEditChampionship(championship)}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.96 }}
                    className="btn btn-sm btn-ghost gap-1 rounded-xl hover:bg-primary/10"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleDeleteChampionship(championship)}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.96 }}
                    className="btn btn-sm btn-ghost gap-1 rounded-xl text-error hover:bg-error/10"
                    title="Excluir"
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-3 backdrop-blur-md sm:p-4"
            onClick={() => {
              setShowForm(false);
              setEditingChampionship(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className={cn(modalShell, 'max-w-4xl')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-base-100/90 px-4 py-3 backdrop-blur-xl dark:bg-base-200/85 sm:px-5">
                <h2 className="text-lg font-black sm:text-xl">
                  {editingChampionship ? 'Editar Campeonato' : 'Novo Campeonato'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingChampionship(null);
                  }}
                  className="btn btn-sm btn-circle btn-ghost"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 sm:p-5">
                <ChampionshipForm
                  championship={editingChampionship}
                  onSave={handleSaveChampionship}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingChampionship(null);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingTables && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-3 backdrop-blur-md sm:p-4"
            onClick={() => setViewingTables(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className={cn(modalShell, 'max-w-6xl')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-white/10 bg-base-100/90 px-4 py-3 backdrop-blur-xl dark:bg-base-200/85 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black tracking-tight sm:text-xl">
                      Tabelas — {viewingTables.championship.nome}
                    </h2>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-base-content/45">
                      Validade dos dados (motor Poisson)
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TableStatus
                        updatedAt={tablePreviewFreshnessMs ?? undefined}
                        className="shadow-inner"
                      />
                      {!tablePreviewFreshnessMs && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/50">
                          Sem data de referência
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingTables(null)}
                    className="btn btn-sm btn-circle btn-ghost shrink-0"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="space-y-6 p-4 sm:p-5">
                {viewingTables.tables.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-base-200/30 py-12 text-center text-sm text-base-content/60 backdrop-blur-sm">
                    Nenhuma tabela cadastrada para este campeonato.
                  </div>
                ) : (
                  viewingTables.tables.map((table) => <ChampionshipTableView key={table.id} table={table} />)
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updatingTables && (
          <ChampionshipTableUpdateModal
            championship={updatingTables.championship}
            existingTables={updatingTables.tables}
            onClose={() => setUpdatingTables(null)}
            onSaveTable={saveTable}
            onReloadTables={async () => {
              const tables = await loadTables(updatingTables.championship.id);
              setUpdatingTables({ championship: updatingTables.championship, tables });
              if (viewingTables?.championship.id === updatingTables.championship.id) {
                setViewingTables({ championship: viewingTables.championship, tables });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChampionshipsScreen;
