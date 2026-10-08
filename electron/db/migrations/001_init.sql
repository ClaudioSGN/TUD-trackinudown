PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS condominios (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, nome_norm TEXT NOT NULL UNIQUE,
  endereco TEXT NOT NULL DEFAULT '', contato TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
  arquivado INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY, nome TEXT NOT NULL UNIQUE, ordem INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS atendimentos (
  id INTEGER PRIMARY KEY, condominio_id INTEGER NOT NULL REFERENCES condominios(id),
  titulo TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', categoria TEXT NOT NULL DEFAULT 'Suporte remoto',
  status TEXT NOT NULL CHECK (status IN ('Aberto','Em andamento','Concluído')) DEFAULT 'Aberto',
  prioridade TEXT NOT NULL CHECK (prioridade IN ('Baixa','Normal','Alta')) DEFAULT 'Normal',
  data_atendimento TEXT NOT NULL, concluido_em TEXT, criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL, excluido_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_atend_cond_data ON atendimentos(condominio_id, data_atendimento DESC);
CREATE INDEX IF NOT EXISTS idx_atend_status ON atendimentos(status);
CREATE TABLE IF NOT EXISTS anexos (
  id INTEGER PRIMARY KEY, atendimento_id INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  caminho TEXT NOT NULL, miniatura TEXT NOT NULL, nome_original TEXT NOT NULL DEFAULT '',
  largura INTEGER, altura INTEGER, bytes INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS atendimento_relacoes (
  atendimento_a INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  atendimento_b INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  criado_em TEXT NOT NULL,
  CHECK (atendimento_a < atendimento_b),
  PRIMARY KEY (atendimento_a, atendimento_b)
);
CREATE TABLE IF NOT EXISTS atendimento_atualizacoes (
  id INTEGER PRIMARY KEY,
  atendimento_id INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('criacao','nota','status','categoria')),
  texto TEXT NOT NULL DEFAULT '', valor_anterior TEXT, valor_novo TEXT,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_atualizacoes_atendimento_data ON atendimento_atualizacoes(atendimento_id, criado_em DESC, id DESC);
CREATE TABLE IF NOT EXISTS lembretes (
  id INTEGER PRIMARY KEY,
  titulo TEXT NOT NULL, observacoes TEXT NOT NULL DEFAULT '', lembrete_em TEXT NOT NULL,
  atendimento_id INTEGER REFERENCES atendimentos(id) ON DELETE SET NULL,
  concluido INTEGER NOT NULL DEFAULT 0, notificado_em TEXT, criado_em TEXT NOT NULL, concluido_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_lembretes_estado_data ON lembretes(concluido, lembrete_em);
CREATE VIRTUAL TABLE IF NOT EXISTS atendimentos_fts USING fts5(
  titulo, descricao, content='atendimentos', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS atendimentos_ai AFTER INSERT ON atendimentos BEGIN
  INSERT INTO atendimentos_fts(rowid,titulo,descricao) VALUES(new.id,new.titulo,new.descricao);
END;
CREATE TRIGGER IF NOT EXISTS atendimentos_ad AFTER DELETE ON atendimentos BEGIN
  INSERT INTO atendimentos_fts(atendimentos_fts,rowid,titulo,descricao) VALUES('delete',old.id,old.titulo,old.descricao);
END;
CREATE TRIGGER IF NOT EXISTS atendimentos_au AFTER UPDATE ON atendimentos BEGIN
  INSERT INTO atendimentos_fts(atendimentos_fts,rowid,titulo,descricao) VALUES('delete',old.id,old.titulo,old.descricao);
  INSERT INTO atendimentos_fts(rowid,titulo,descricao) VALUES(new.id,new.titulo,new.descricao);
END;

