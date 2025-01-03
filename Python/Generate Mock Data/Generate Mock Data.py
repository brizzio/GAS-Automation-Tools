import random
import faker

# Initialize Faker
fake = faker.Faker()

def generate_mock_data(num_records):
    """
    Generate a list of mock data records.

    :param num_records: Number of records to generate.
    :return: List of dictionaries containing mock data.
    """
    mock_data = []
    for _ in range(num_records):
        record = {
            "First Name": fake.first_name(),
            "Last Name": fake.last_name(),
            "Phone Number": fake.phone_number(),
            "Email": fake.email(),
            "Website": fake.url()
        }
        mock_data.append(record)
    return mock_data

# Set the number of records to generate
num_records = 10

# Generate and display mock data
mock_data = generate_mock_data(num_records)
for record in mock_data:
    print(record)
