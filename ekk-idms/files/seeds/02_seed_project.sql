-- NH-46 Gwalior-Shivpuri pilot project
INSERT INTO projects (project_code, name, client, project_type, location, contract_value)
VALUES (
    'NH46-GWL',
    'Improvement of riding quality - Gwalior Shivpuri Section NH-46',
    'NHAI - PIU Gwalior',
    'highway',
    'Gwalior, Madhya Pradesh',
    183274650.00
)
ON CONFLICT (project_code) DO NOTHING;
