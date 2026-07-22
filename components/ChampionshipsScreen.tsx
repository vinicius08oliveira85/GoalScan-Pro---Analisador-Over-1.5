import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Edit, Trash2, Eye, ExternalLink } from 'lucide-react';
import { useChampionships } from '../hooks/useChampionships';
import { Championship, ChampionshipTable } from '../types';
import ChampionshipForm from './ChampionshipForm';
import ChampionshipTableView from './ChampionshipTableView';
import FbrefExtractionModal from './FbrefExtractionModal';
import ModalShell from './ui/ModalShell';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import { SkeletonCard } from './Skeleton';
import Skeleton from './Skeleton';

const ChampionshipsScreen: React.FC = () => {
  const handleError = (message: string) => {
    console.error('[ChampionshipsScreen]', message);
  };

  const { championships, isLoading, isSaving, save, remove, loadTables, removeTable } =
    useChampionships(handleError);

  const [showForm, setShowForm] = useState(false);
  const [editingChampionship, setEditingChampionship] = useState<Championship | null>(null);
  const [viewingTables, setViewingTables] = useState<{
    championship: Championship;
    tables: ChampionshipTable[];
  } | null>(null);
  const [extractingFbref, setExtractingFbref] = useState<Championship | null>(null);
  const [deletingTable, setDeletingTable] = useState<{
    championship: Championship;
    table: ChampionshipTable;
  } | null>(null);

  const handleNewChampionship = () => {
    setEditingChampionship(null);
    setShowForm(true);
  };

  const handleEditChampionship = (championship: Championship) => {
    setEditingChampionship(championship);
    setShowForm(true);
  };

  const handleDeleteChampionship = async (championship: Championship) => {
    await remove(championship.id);
  };

  const handleViewTables = async (championship: Championship) => {
    const tables = await loadTables(championship.id);
    setViewingTables({ championship, tables });
  };

  const handleSaveChampionship = async (championship: Championship) => {
    try {
      const savedChampionship = await save(championship);
      if (savedChampionship) {
        setShowForm(false);
        setEditingChampionship(null);
        setExtractingFbref(savedChampionship);
      } else {
        handleError('Erro ao salvar campeonato');
      }
    } catch (error) {
      console.error('[ChampionshipsScreen] Erro ao salvar campeonato:', error);
      handleError(`Erro ao salvar campeonato: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleConfirmDeleteTable = async () => {
    if (!deletingTable) return;
    const { championship, table } = deletingTable;
    const success = await removeTable(championship.id, table.table_type);
    if (success) {
      const updatedTables = await loadTables(championship.id);
      setViewingTables({ championship, tables: updatedTables });
    }
    setDeletingTable(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="rectangular" height={48} width="40%" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
            <Trophy className="w-6 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight">
              <span className="text-gradient">Campeonatos</span>
            </h1>
            <p className="text-xs md:text-sm text-base-content/50 mt-0.5">
              Gerencie seus campeonatos e tabelas de classificacao
            </p>
          </div>
        </div>
        <button onClick={handleNewChampionship} className="btn btn-primary btn-sm gap-1.5 shadow-lg">
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {/* Lista de Campeonatos */}
      {championships.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-12 h-12 md:w-14 md:h-14" aria-hidden="true" />}
          title="Nenhum Campeonato Cadastrado"
          description="Comece criando seu primeiro campeonato e adicione as tabelas via FBref."
          actions={
            <button onClick={handleNewChampionship} className="btn btn-primary btn-lg gap-2 shadow-xl hover:shadow-2xl">
              <Plus className="w-5 h-5" aria-hidden="true" />
              Criar Primeiro Campeonato
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {championships.map((championship) => (
            <motion.div
              key={championship.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-5 hover:border-base-300/70 transition-colors"
            >
              <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-primary/6 blur-3xl pointer-events-none" />
              <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm md:text-base truncate">{championship.nome}</h3>
                      {championship.table_format && (
                        <span
                          className={`badge badge-sm ${
                            championship.table_format === 'completa'
                              ? 'badge-primary'
                              : 'badge-secondary'
                          }`}
                        >
                          {championship.table_format === 'completa' ? 'Completa' : 'Basica'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-base-content/40 mt-1 space-y-0.5">
                      <p>
                        Criado em:{' '}
                        {championship.created_at
                          ? new Date(championship.created_at).toLocaleDateString('pt-BR')
                          : 'Data nao disponivel'}
                      </p>
                      {championship.uploaded_at && (
                        <p>
                          Ultimo upload:{' '}
                          {new Date(championship.uploaded_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mt-3 relative z-10">
                <button
                  onClick={() => handleViewTables(championship)}
                  className="btn btn-sm btn-ghost flex-1 gap-1 text-xs"
                  title="Visualizar Tabelas"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Tabelas
                </button>
                <button
                  onClick={() => setExtractingFbref(championship)}
                  className="btn btn-sm btn-ghost flex-1 gap-1 text-xs"
                  title="Extrair Dados do FBref.com"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  FBref
                </button>
                <button
                  onClick={() => handleEditChampionship(championship)}
                  className="btn btn-sm btn-ghost gap-1"
                  title="Editar"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteChampionship(championship)}
                  className="btn btn-sm btn-ghost text-error hover:bg-error/10 gap-1"
                  title="Excluir"
                  disabled={isSaving}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de Formulário */}
      <ModalShell
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingChampionship(null);
        }}
        title={editingChampionship ? 'Editar Campeonato' : 'Novo Campeonato'}
        panelClassName="max-w-2xl"
      >
        <ChampionshipForm
          championship={editingChampionship}
          onSave={handleSaveChampionship}
          onCancel={() => {
            setShowForm(false);
            setEditingChampionship(null);
          }}
        />
      </ModalShell>

      {/* Modal de Visualização de Tabelas */}
      <ModalShell
        isOpen={!!viewingTables}
        onClose={() => setViewingTables(null)}
        title={viewingTables ? `Tabelas - ${viewingTables.championship.nome}` : undefined}
        panelClassName="max-w-6xl"
      >
        <div className="p-4 space-y-6">
          {viewingTables?.tables.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              Nenhuma tabela cadastrada para este campeonato.
              <br />
              Use o botão <strong>FBref</strong> para extrair e colar as tabelas.
            </div>
          ) : (
            viewingTables?.tables.map((table) => (
              <ChampionshipTableView
                key={table.id}
                table={table}
                onDelete={(t) => {
                  if (viewingTables) {
                    setDeletingTable({ championship: viewingTables.championship, table: t });
                  }
                }}
              />
            ))
          )}
        </div>
      </ModalShell>

      {/* Modal de Extração FBref */}
      {extractingFbref && (
        <FbrefExtractionModal
          championship={extractingFbref}
          onClose={() => setExtractingFbref(null)}
          onTableSaved={async () => {
            if (viewingTables?.championship.id === extractingFbref.id) {
              const tables = await loadTables(extractingFbref.id);
              setViewingTables({ championship: extractingFbref, tables });
            }
            setExtractingFbref(null);
          }}
          onError={handleError}
        />
      )}

      {/* Confirm Dialog para exclusão de tabela */}
      <ConfirmDialog
        isOpen={!!deletingTable}
        onClose={() => setDeletingTable(null)}
        onConfirm={handleConfirmDeleteTable}
        title="Excluir Tabela"
        message={`Deseja excluir a tabela "${deletingTable?.table.table_name || deletingTable?.table.table_type}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
};

export default ChampionshipsScreen;
