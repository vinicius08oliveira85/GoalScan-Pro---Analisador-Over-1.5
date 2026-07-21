import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Championship } from '../types';
import { animations } from '../utils/animations';

interface ChampionshipFormProps {
  championship?: Championship | null;
  onSave: (championship: Championship) => Promise<void>;
  onCancel: () => void;
}

const ChampionshipForm: React.FC<ChampionshipFormProps> = ({
  championship,
  onSave,
  onCancel,
}) => {
  const [nome, setNome] = useState('');
  const [fbrefUrl, setFbrefUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (championship) {
      setNome(championship.nome);
      setFbrefUrl(championship.fbrefUrl ?? '');
    } else {
      setNome('');
      setFbrefUrl('');
    }
  }, [championship]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!nome.trim()) {
      newErrors.nome = 'O nome do campeonato é obrigatório.';
    }

    const fbrefUrlTrimmed = fbrefUrl.trim();
    if (fbrefUrlTrimmed && !fbrefUrlTrimmed.includes('fbref.com')) {
      newErrors.fbrefUrl = 'A URL deve ser do fbref.com (ex: https://fbref.com/en/comps/11/Serie-A-Stats).';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const championshipToSave: Championship = {
        id: championship?.id || crypto.randomUUID(),
        nome: nome.trim(),
        fbrefUrl: fbrefUrlTrimmed ? fbrefUrlTrimmed : null,
        updated_at: new Date().toISOString(),
      };

      await onSave(championshipToSave);
    } catch (error) {
      console.error('Erro ao salvar campeonato:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="custom-card p-4 md:p-6 lg:p-8 flex flex-col gap-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      <h2 className="text-2xl font-bold">
        {championship ? 'Editar Campeonato' : 'Novo Campeonato'}
      </h2>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-bold">Nome do Campeonato</span>
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Ex: Serie A Itália"
          required
        />
        {errors.nome && <span className="text-error text-sm mt-1">{errors.nome}</span>}
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-bold">URL do FBref (opcional)</span>
        </label>
        <input
          type="url"
          value={fbrefUrl}
          onChange={(e) => setFbrefUrl(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Ex: https://fbref.com/en/comps/11/Serie-A-Stats"
        />
        {errors.fbrefUrl && <span className="text-error text-sm mt-1">{errors.fbrefUrl}</span>}
        {!errors.fbrefUrl && (
          <span className="text-xs opacity-70 mt-1">
            Com essa URL salva, você poderá extrair todas as tabelas automaticamente via FBref.
          </span>
        )}
      </div>

      <div className="alert alert-info">
        <div className="text-sm">
          Após criar o campeonato, use o botão <strong>FBref</strong> para extrair e colar as tabelas de classificação.
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </motion.form>
  );
};

export default ChampionshipForm;
