/**
 * REV.IKE curator functions — operate in place on the Exoskeleton chassis.
 * Name is REV.IKE; these are librarian task functions only.
 */

export type ChassisConn = {
  query: (sql: string) => Promise<{ toArray: () => Record<string, unknown>[] }>;
};

export type CuratorIdentity = {
  did: string;
  grants: Array<'read' | 'curate' | 'materialize' | 'admin'>;
};

function requireGrant(id: CuratorIdentity, g: CuratorIdentity['grants'][number]) {
  if (!id.grants.includes(g) && !id.grants.includes('admin')) {
    throw new Error(`REV.IKE curator: missing grant ${g} for ${id.did}`);
  }
}

export async function createMolecule(
  conn: ChassisConn,
  identity: CuratorIdentity,
  moleculeId: string,
): Promise<void> {
  requireGrant(identity, 'curate');
  const did = identity.did.replace(/'/g, "''");
  const mid = moleculeId.replace(/'/g, "''");
  await conn.query(
    `INSERT INTO research_molecules (molecule_id, identity_did)
     VALUES ('${mid}', '${did}')
     ON CONFLICT (molecule_id) DO NOTHING`,
  );
}

export async function purgeMoleculeTimeline(
  conn: ChassisConn,
  identity: CuratorIdentity,
  moleculeId: string,
): Promise<number> {
  requireGrant(identity, 'curate');
  const mid = moleculeId.replace(/'/g, "''");
  // Delete in chain-safe order: clear FK links then rows
  await conn.query(
    `UPDATE atomic_tweens SET prev_tween_id = NULL, next_tween_id = NULL
     WHERE molecule_id = '${mid}'`,
  );
  const before = await conn.query(
    `SELECT COUNT(*)::BIGINT AS n FROM atomic_tweens WHERE molecule_id = '${mid}'`,
  );
  const n = Number(before.toArray()[0]?.n ?? 0);
  await conn.query(`DELETE FROM atomic_tweens WHERE molecule_id = '${mid}'`);
  return n;
}

export async function registerRubric(
  conn: ChassisConn,
  identity: CuratorIdentity,
  rubricId: string,
  capability: string | null,
  difficulty: 'low' | 'medium' | 'high',
  rubricJson: string,
): Promise<void> {
  requireGrant(identity, 'curate');
  const rid = rubricId.replace(/'/g, "''");
  const cap = capability ? `'${capability.replace(/'/g, "''")}'` : 'NULL';
  const json = rubricJson.replace(/'/g, "''");
  await conn.query(
    `INSERT INTO skill_rubrics (rubric_id, capability, difficulty, rubric_json)
     VALUES ('${rid}', ${cap}, '${difficulty}', '${json}'::JSON)
     ON CONFLICT (rubric_id) DO UPDATE SET
       rubric_json = excluded.rubric_json,
       difficulty = excluded.difficulty`,
  );
}

export async function stopWorkspaceWrites(
  identity: CuratorIdentity,
): Promise<{ stopped: true; by: string }> {
  requireGrant(identity, 'admin');
  // Operational stop signal for operators; consumers check this flag out-of-band.
  return { stopped: true, by: identity.did };
}
