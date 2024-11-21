#!/usr/bin/env python
# coding: utf-8

# In[1]:


import os
import json
import pandas as pd
from glob import glob

def extract_messages_data(folder_path):
    data = []
    group_folders = glob(os.path.join(folder_path, 'Google Chat', 'Groups', '*'))

    for group_folder in group_folders:
        group_type = "DM" if "DM" in group_folder else "Space"
        group_id = os.path.basename(group_folder).split()[-1]

        messages_path = os.path.join(group_folder, 'messages.json')
        group_info_path = os.path.join(group_folder, 'group_info.json')

        # Extract space name from group_info.json if it's a "Space" type
        space_name = None
        if group_type == "Space" and os.path.exists(group_info_path):
            with open(group_info_path, 'r', encoding='utf-8') as group_info_file:
                group_info = json.load(group_info_file)
                space_name = group_info.get("name")

        # Process each message in messages.json
        if os.path.exists(messages_path):
            with open(messages_path, 'r', encoding='utf-8') as messages_file:
                messages_json = json.load(messages_file)
                for message in messages_json.get("messages", []):
                    record = {
                        "GroupType": group_type,
                        "GroupId": group_id,
                        "SendersName": message["creator"].get("name"),
                        "SendersEmail": message["creator"].get("email"),
                        "MessageTimestamp": message.get("created_date"),
                        "MessageContent": message.get("text"),
                        "SpaceName": space_name if group_type == "Space" else None
                    }
                    data.append(record)

    return data

# Use the current working directory to construct the path
current_dir = os.getcwd()
folder_path = os.path.join(current_dir, 'TakeOut')

# Extract the data and load it into a DataFrame
messages_data = extract_messages_data(folder_path)
df = pd.DataFrame(messages_data)

# Save the DataFrame to an Excel file
output_path = os.path.join(current_dir, 'GoogleChatMessages.xlsx')
df.to_excel(output_path, index=False)
print(f"Data successfully saved to {output_path}")


# In[ ]:




