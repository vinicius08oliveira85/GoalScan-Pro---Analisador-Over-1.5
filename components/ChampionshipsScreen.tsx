import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Plus, Edit, Trash2, Eye, X } from 'lucide-react';
import { useChampionships } from '../hooks/useChampionships';
import { Championship, ChampionshipTable } from '../types';
import ChampionshipForm from './ChampionshipForm';
import ChampionshipTableView from './ChampionshipTableView';
import { animations } from '../utils/animations';

const ChampionshipsScreen: React.FC = () => {
  const { championships, isLoading, isSaving, save, remove, loadTables, saveTable } =
    useChampionships();
  const [showForm, setShowForm] = useState(false);
  const [editingChampionship, setEditingChampionship] = useState<Championship | null>(null);
  const [viewingTables, setViewingTables] = useState<{
    championship: Championship;
    tables: ChampionshipTable[];
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

  const handleSaveChampionship = async (
    championship: Championship,
    tables: ChampionshipTable[]
  ) => {
    // Salvar campeonato
    const savedChampionship = await save(championship);

    if (savedChampionship) {
      // Salvar tabelas
      for (const table of tables) {
        await saveTable({
          ...table,
          championship_id: savedChampionship.id,
        });
      }

      setShowForm(false);
      setEditingChampionship(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-12 w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            Campeonatos
          </h1>
          <p className="text-base-content/60 mt-2">
            Gerencie seus campeonatos e tabelas de classificação
          </p>
        </div>
        <button onClick={handleNewChampionship} className="btn btn-primary gap-2">
          <Plus className="w-5 h-5" />
          Novo Campeonato
        </button>
      </div>

      {/* Lista de Campeonatos */}
      {championships.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="custom-card p-12 md:p-16 flex flex-col items-center justify-center text-center border-dashed border-2"
        >
          <div className="w-32 h-32 rounded-full border-4 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-6">
            <Trophy className="w-16 h-16 text-primary opacity-60" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Nenhum Campeonato Cadastrado</h3>
          <p className="text-base-content/60 mb-6">
            Comece criando seu primeiro campeonato e adicione as tabelas de classificação.
          </p>
          <button onClick={handleNewChampionship} className="btn btn-primary gap-2">
            <Plus className="w-5 h-5" />
            Criar Primeiro Campeonato
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {championships.map((championship) => (
            <motion.div
              key={championship.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="custom-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{championship.nome}</h3>
                    <p className="text-sm text-base-content/60">
                      {championship.created_at
                        ? new Date(championship.created_at).toLocaleDateString('pt-BR')
                        : 'Data não disponível'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleViewTables(championship)}
                  className="btn btn-sm btn-ghost flex-1 gap-1"
                  title="Visualizar Tabelas"
                >
                  <Eye className="w-4 h-4" />
                  Tabelas
                </button>
                <button
                  onClick={() => handleEditChampionship(championship)}
                  className="btn btn-sm btn-ghost gap-1"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteChampionship(championship)}
                  className="btn btn-sm btn-ghost text-error hover:bg-error/10 gap-1"
                  title="Excluir"
                  disabled={isSaving}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de Formulário */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => {
              setShowForm(false);
              setEditingChampionship(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-base-100 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-base-100 border-b border-base-300 p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold">
                  {editingChampionship ? 'Editar Campeonato' : 'Novo Campeonato'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingChampionship(null);
                  }}
                  className="btn btn-sm btn-ghost btn-circle"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
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

      {/* Modal de Visualização de Tabelas */}
      <AnimatePresence>
        {viewingTables && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setViewingTables(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-base-100 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-base-100 border-b border-base-300 p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold">
                  Tabelas - {viewingTables.championship.nome}
                </h2>
                <button
                  onClick={() => setViewingTables(null)}
                  className="btn btn-sm btn-ghost btn-circle"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-6">
                {viewingTables.tables.length === 0 ? (
                  <div className="text-center py-12 text-base-content/60">
                    Nenhuma tabela cadastrada para este campeonato.
                  </div>
                ) : (
                  viewingTables.tables.map((table) => (
                    <ChampionshipTableView key={table.id} table={table} />
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChampionshipsScreen;

