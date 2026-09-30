BEGIN;

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM notification_outbox
  WHERE id IN (
    'ab0769be-cdf4-41a8-a424-6a69becfc077',
    'faa61d94-0ad5-4d4b-ab19-4c345a7100a4',
    '99edb90e-8583-4666-9228-4e623054c395',
    '53109e7d-f729-4343-8ed3-c699228128be',
    '5fa42e7f-a6b5-44bc-9c17-41920d7e1626',
    '9f5a0355-d484-4b8a-a1db-afd50fca0cc0',
    'dad13da7-0805-4c2f-8189-9be73e529169',
    'fa1fc873-b29b-47fb-bad4-6b4e2b336f6f',
    '186dc675-e87c-4932-9417-de2e96deef99',
    'c8c99039-d773-4619-97d0-0fd7799aef49',
    '01de917b-32ff-4255-9a50-8286f0e87e1c',
    '14a5a1b9-4ba6-4837-8d2e-20e1b13a5807',
    '57240717-6fe4-4191-bbd0-089abe7faa01',
    'f0d46a0c-5abc-4a6b-86c7-607c74b3fdfa',
    'a9945a05-dcea-4549-83e5-feb4f2aa9393',
    '742a455c-3cd9-4a37-9c33-8067f00dfbb7',
    'b5b4a0f8-74ba-40b1-91d8-ebafac1166ed',
    '3893ef59-312c-4f43-becf-dcb4adc40a19',
    'fac496a4-3a7b-4059-a222-96de60b6ec4a',
    '95830788-aadd-401d-b236-629129cd0b07'
  );

  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 rows, found %', v_count;
  END IF;

  DELETE FROM notification_outbox
  WHERE id IN (
    'ab0769be-cdf4-41a8-a424-6a69becfc077',
    'faa61d94-0ad5-4d4b-ab19-4c345a7100a4',
    '99edb90e-8583-4666-9228-4e623054c395',
    '53109e7d-f729-4343-8ed3-c699228128be',
    '5fa42e7f-a6b5-44bc-9c17-41920d7e1626',
    '9f5a0355-d484-4b8a-a1db-afd50fca0cc0',
    'dad13da7-0805-4c2f-8189-9be73e529169',
    'fa1fc873-b29b-47fb-bad4-6b4e2b336f6f',
    '186dc675-e87c-4932-9417-de2e96deef99',
    'c8c99039-d773-4619-97d0-0fd7799aef49',
    '01de917b-32ff-4255-9a50-8286f0e87e1c',
    '14a5a1b9-4ba6-4837-8d2e-20e1b13a5807',
    '57240717-6fe4-4191-bbd0-089abe7faa01',
    'f0d46a0c-5abc-4a6b-86c7-607c74b3fdfa',
    'a9945a05-dcea-4549-83e5-feb4f2aa9393',
    '742a455c-3cd9-4a37-9c33-8067f00dfbb7',
    'b5b4a0f8-74ba-40b1-91d8-ebafac1166ed',
    '3893ef59-312c-4f43-becf-dcb4adc40a19',
    'fac496a4-3a7b-4059-a222-96de60b6ec4a',
    '95830788-aadd-401d-b236-629129cd0b07'
  );
END $$;

COMMIT;
