import PersonalModule from './PersonalModule';
import PersonalAreasModule from './PersonalAreasModule';

const PersonalPage = () => {
  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ marginBottom: '0.35rem' }}>Personal</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Registro, edición y organización del personal con sus áreas asignadas.
        </p>
      </div>

      <PersonalModule title="Registro Personal" />
      <PersonalAreasModule title="Gestión de Personal" />
    </div>
  );
};

export default PersonalPage;
