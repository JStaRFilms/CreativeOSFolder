














import os







import re







import shutil







import subprocess







import argparse







from datetime import datetime















def set_file_times(file_path, new_date):







    """







    Sets the creation and modification time of a file using PowerShell.







    This is necessary for changing the creation time on Windows.







    """







    try:







        # Format for PowerShell: 'YYYY-MM-DD HH:MM:SS'







        date_str = new_date.strftime('%Y-%m-%d %H:%M:%S')







        







        # PowerShell commands to set creation and last write time







        ps_command = (







            f'$item = Get-Item -LiteralPath "{file_path}"; '







            f'$item.CreationTime = Get-Date "{date_str}"; '







            f'$item.LastWriteTime = Get-Date "{date_str}";'







        )







        







        # Execute the command







        subprocess.run(







            ["powershell", "-NoProfile", "-Command", ps_command],







            check=True,







            capture_output=True,







            text=True







        )







    except subprocess.CalledProcessError as e:







        print(f"Error updating metadata for {os.path.basename(file_path)}: {e.stderr}")







    except Exception as e:







        print(f"An unexpected error occurred: {e}")















def get_unique_dest_path(dest_path):







    """







    Checks if a destination path exists. If so, it appends a number







    like (1), (2), etc., to the filename until a unique path is found.







    """







    if not os.path.exists(dest_path):







        return dest_path







    







    base, ext = os.path.splitext(dest_path)







    counter = 1







    while True:







        new_dest_path = f"{base}({counter}){ext}"







        if not os.path.exists(new_dest_path):







            return new_dest_path







        counter += 1















def process_files(move_files=False):







    """







    Processes files in the current directory to fix their metadata.







    """







    source_dir = os.getcwd()







    export_dir = os.path.join(source_dir, "export")















    # Create the export directory if it doesn't exist







    if not os.path.exists(export_dir):







        os.makedirs(export_dir)







        print(f"Created directory: {export_dir}")















    # Regex to find dates in filenames







    # Pattern 1: VID-YYYYMMDD or IMG-YYYYMMDD







    pattern1 = re.compile(r"(?:VID|IMG)-(\d{8})")







    # Pattern 2: WhatsApp Image YYYY-MM-DD or WhatsApp Video YYYY-MM-DD







    pattern2 = re.compile(r"WhatsApp (?:Image|Video) (\d{4}-\d{2}-\d{2})")















    for filename in os.listdir(source_dir):







        source_path = os.path.join(source_dir, filename)







        # Skip directories and the script itself







        if not os.path.isfile(source_path) or filename == "fix_metadata.py":







            continue















        file_date = None







        date_str = None















        match1 = pattern1.search(filename)







        if match1:







            date_str = match1.group(1)







            file_date = datetime.strptime(date_str, "%Y%m%d")







        else:







            match2 = pattern2.search(filename)







            if match2:







                date_str = match2.group(1)







                file_date = datetime.strptime(date_str, "%Y-%m-%d")















        if file_date:







            try:







                # Get a unique destination path to avoid overwriting







                initial_dest_path = os.path.join(export_dir, filename)







                dest_path = get_unique_dest_path(initial_dest_path)







                final_filename = os.path.basename(dest_path)















                action_str = "Copied"







                if move_files:







                    action_str = "Moved"







                    shutil.move(source_path, dest_path)







                else:







                    shutil.copy2(source_path, dest_path)







                







                # Set the new metadata on the copied/moved file







                set_file_times(dest_path, file_date)















                if final_filename == filename:







                    print(f"{action_str} and updated metadata for: {filename}")







                else:







                    print(f"{action_str} '{filename}' as '{final_filename}' and updated metadata.")















            except ValueError:







                print(f"Skipping {filename}: could not parse date '{date_str}'.")







            except FileNotFoundError:







                # This can happen if a file is moved and the loop somehow sees it again







                continue







        else:







            print(f"Skipping {filename}: does not match any expected name format.")















if __name__ == "__main__":







    parser = argparse.ArgumentParser(







        description="Fixes metadata of video and image files based on their filename."







    )







    parser.add_argument(







        "--move",







        action="store_true",







        help="Move files to the 'export' directory instead of copying."







    )







    args = parser.parse_args()















    process_files(move_files=args.move)







    print("\nProcessing complete.")














