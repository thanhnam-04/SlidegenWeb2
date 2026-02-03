import os
import sys
from pathlib import Path
from calculate_slide_score import calculate_slide_error_score
import json


def find_slide_pairs(folder_path):
    """
    Tìm tất cả các cặp slide (input.html, output.html) trong các subfolder.
    
    Cấu trúc yêu cầu:
    slides_folder/
      ├── slide_01/
      │   ├── input.html
      │   └── output.html
      ├── slide_02/
          ├── input.html
          └── output.html
    
    Returns:
        list: [(input_path, output_path, slide_name), ...]
    """
    folder = Path(folder_path)
    
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder}")
    
    pairs = []
    
    # Duyệt qua từng subfolder
    for subfolder in sorted([f for f in folder.iterdir() if f.is_dir()]):
        input_file = subfolder / "input.html"
        output_file = subfolder / "output.html"
        
        if input_file.exists() and output_file.exists():
            pairs.append((input_file, output_file, subfolder.name))
        else:
            # Cảnh báo nếu thiếu file
            if not input_file.exists():
                print(f"   ⚠️  Missing input.html in {subfolder.name}")
            if not output_file.exists():
                print(f"   ⚠️  Missing output.html in {subfolder.name}")
    
    return pairs


def batch_calculate_scores(folder_path, output_json=None, verbose=False):
    """
    Tính điểm cho tất cả các slide trong folder.
    
    Args:
        folder_path: Đường dẫn đến folder chứa slides
        output_json: Đường dẫn file JSON để lưu kết quả (optional)
        verbose: In chi tiết từng slide
        
    Returns:
        dict: {
            'total_slides': int,
            'average_score': float,
            'slides': [
                {
                    'name': str,
                    'input_file': str,
                    'output_file': str,
                    'score': float,
                    'total_errors': int,
                    'overlap_errors': int,
                    'container_overflow_errors': int,
                    'viewport_overflow_errors': int,
                    'error_percentages': list
                },
                ...
            ],
            'summary': {
                'excellent': int,  # score >= 9.0
                'good': int,       # score >= 7.5
                'fair': int,       # score >= 5.0
                'poor': int,       # score >= 2.5
                'critical': int    # score < 2.5
            }
        }
    """
    print(f"🔍 Scanning folder: {folder_path}\n")
    
    pairs = find_slide_pairs(folder_path)
    
    if not pairs:
        print("❌ No slide pairs found!")
        print("\nExpected structure:")
        print("  slides_folder/")
        print("    ├── slide_01/")
        print("    │   ├── input.html")
        print("    │   └── output.html")
        print("    ├── slide_02/")
        print("        ├── input.html")
        print("        └── output.html")
        return None
    
    print(f"✅ Found {len(pairs)} slide pairs\n")
    print("="*80)
    
    results = {
        'total_slides': len(pairs),
        'average_score': 0.0,
        'slides': [],
        'summary': {
            'excellent': 0,
            'good': 0,
            'fair': 0,
            'poor': 0,
            'critical': 0
        }
    }
    
    total_score = 0.0
    
    for idx, (input_file, output_file, slide_name) in enumerate(pairs, 1):
        print(f"\n[{idx}/{len(pairs)}] Processing: {slide_name}")
        print(f"   Input:  {input_file.name}")
        print(f"   Output: {output_file.name}")
        
        try:
            score_result = calculate_slide_error_score(str(input_file), str(output_file))
            
            slide_data = {
                'name': slide_name,
                'input_file': str(input_file),
                'output_file': str(output_file),
                'score': score_result['score'],
                'total_errors': score_result['total_errors'],
                'overlap_errors': score_result['overlap_errors'],
                'container_overflow_errors': score_result['container_overflow_errors'],
                'viewport_overflow_errors': score_result['viewport_overflow_errors'],
                'error_percentages': score_result['error_percentages']
            }
            
            results['slides'].append(slide_data)
            total_score += score_result['score']
            
            # Phân loại chất lượng
            score = score_result['score']
            if score >= 9.0:
                quality = "✅ EXCELLENT"
                results['summary']['excellent'] += 1
            elif score >= 7.5:
                quality = "🟢 GOOD"
                results['summary']['good'] += 1
            elif score >= 5.0:
                quality = "🟡 FAIR"
                results['summary']['fair'] += 1
            elif score >= 2.5:
                quality = "🟠 POOR"
                results['summary']['poor'] += 1
            else:
                quality = "🔴 CRITICAL"
                results['summary']['critical'] += 1
            
            print(f"   Score: {score:.2f} / 10.00 ({quality})")
            print(f"   Errors: {score_result['total_errors']} total "
                  f"({score_result['overlap_errors']} overlap, "
                  f"{score_result['container_overflow_errors']} container, "
                  f"{score_result['viewport_overflow_errors']} viewport)")
            
            if verbose and score_result['total_errors'] > 0:
                _print_brief_errors(score_result)
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            results['slides'].append({
                'name': slide_name,
                'input_file': str(input_file),
                'output_file': str(output_file),
                'score': 0.0,
                'total_errors': -1,
                'error': str(e)
            })
    
    # Tính điểm trung bình
    if results['slides']:
        valid_scores = [s['score'] for s in results['slides'] if s.get('score', 0) > 0]
        results['average_score'] = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
    
    # In báo cáo tổng hợp
    _print_batch_summary(results)
    
    # Lưu JSON nếu được yêu cầu
    if output_json:
        output_path = Path(output_json)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Results saved to: {output_path}")
    
    return results


def _print_brief_errors(score_result):
    """In tóm tắt các lỗi"""
    details = score_result['details']
    
    if details['overlap']:
        print(f"      Overlaps:")
        for err in details['overlap'][:3]:  # Chỉ in 3 lỗi đầu
            print(f"        • {err['overlap_percent']:.1f}% - "
                  f"{err['element1']['tag']}.{err['element1']['class']} ↔ "
                  f"{err['element2']['tag']}.{err['element2']['class']}")
        if len(details['overlap']) > 3:
            print(f"        ... and {len(details['overlap']) - 3} more")
    
    if details['container_overflow']:
        print(f"      Container overflows:")
        for err in details['container_overflow'][:3]:
            print(f"        • {err['overflow_percent']:.1f}% - "
                  f"{err['text']['tag']}.{err['text']['class']} in "
                  f"{err['parent']['tag']}.{err['parent']['class']}")
        if len(details['container_overflow']) > 3:
            print(f"        ... and {len(details['container_overflow']) - 3} more")
    
    if details['viewport_overflow']:
        print(f"      Viewport overflows:")
        for err in details['viewport_overflow'][:3]:
            directions = err['overflow']['directions']
            print(f"        • {err['overflow_percent']:.1f}% - "
                  f"{err['text']['tag']}.{err['text']['class']} "
                  f"({', '.join(directions)})")
        if len(details['viewport_overflow']) > 3:
            print(f"        ... and {len(details['viewport_overflow']) - 3} more")


def _print_batch_summary(results):
    """In báo cáo tổng hợp"""
    print("\n" + "="*80)
    print("📊 BATCH SCORING SUMMARY")
    print("="*80)
    
    print(f"\n📝 Total Slides: {results['total_slides']}")
    print(f"📈 Average Score: {results['average_score']:.2f} / 10.00")
    
    print("\n🎯 Quality Distribution:")
    print(f"   ✅ EXCELLENT (≥9.0):  {results['summary']['excellent']:3d} slides")
    print(f"   🟢 GOOD (≥7.5):       {results['summary']['good']:3d} slides")
    print(f"   🟡 FAIR (≥5.0):       {results['summary']['fair']:3d} slides")
    print(f"   🟠 POOR (≥2.5):       {results['summary']['poor']:3d} slides")
    print(f"   🔴 CRITICAL (<2.5):   {results['summary']['critical']:3d} slides")
    
    # Top 5 best slides
    sorted_slides = sorted(results['slides'], key=lambda x: x.get('score', 0), reverse=True)
    
    print("\n🏆 Top 5 Best Slides:")
    for idx, slide in enumerate(sorted_slides[:5], 1):
        print(f"   {idx}. {slide['name']:30s} - {slide['score']:.2f} / 10.00")
    
    # Top 5 worst slides
    print("\n⚠️  Top 5 Worst Slides:")
    for idx, slide in enumerate(sorted_slides[-5:][::-1], 1):
        print(f"   {idx}. {slide['name']:30s} - {slide['score']:.2f} / 10.00")
    
    # Tổng số lỗi
    total_errors = sum(s.get('total_errors', 0) for s in results['slides'] if s.get('total_errors', 0) > 0)
    total_overlap = sum(s.get('overlap_errors', 0) for s in results['slides'])
    total_container = sum(s.get('container_overflow_errors', 0) for s in results['slides'])
    total_viewport = sum(s.get('viewport_overflow_errors', 0) for s in results['slides'])
    
    print(f"\n📊 Total Errors Detected: {total_errors}")
    print(f"   - Text overlaps:          {total_overlap}")
    print(f"   - Container overflows:    {total_container}")
    print(f"   - Viewport overflows:     {total_viewport}")
    
    print("\n" + "="*80)


# Main function
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Batch calculate quality scores for multiple slides",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Expected folder structure:
  slides_folder/
    ├── slide_01/
    │   ├── input.html
    │   └── output.html
    ├── slide_02/
        ├── input.html
        └── output.html

Examples:
  python batch_score_calculator.py slides_folder
  python batch_score_calculator.py slides_folder --output results.json
  python batch_score_calculator.py slides_folder --verbose
        """
    )
    
    parser.add_argument('folder', help='Folder containing slide pairs (input.html / output.html)')
    parser.add_argument('--output', '-o', help='Save results to JSON file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Print detailed errors for each slide')
    
    args = parser.parse_args()
    
    try:
        results = batch_calculate_scores(args.folder, args.output, args.verbose)
        
        if results:
            # Exit code: 0 nếu average score >= 5.0, 1 nếu < 5.0
            sys.exit(0 if results['average_score'] >= 5.0 else 1)
        else:
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
